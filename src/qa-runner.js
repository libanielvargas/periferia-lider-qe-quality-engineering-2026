// Capa de revisión para la persona evaluadora. No forma parte del sistema bajo prueba:
// server.js solo la registra. Ejecuta ÚNICAMENTE la suite Playwright predefinida.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const runsRoot = path.resolve(process.env.QA_RUNS_DIR || path.join(projectRoot, 'runs'));
const documents = new Set(['DIAGNOSTICO.md', 'DECISIONES.md', 'REVISION_PR.md', 'CAMBIOS.md', 'DESPLIEGUE.md']);

// off: deshabilitado · local: solo desde localhost · public: detrás del reverse proxy con límites.
const mode = process.env.QA_RUNNER_MODE || 'local';
const limits = {
  workers: Number(process.env.QA_RUNNER_WORKERS || 1),
  timeoutMs: Number(process.env.QA_RUNNER_TIMEOUT_SECONDS || 180) * 1000,
  cooldownMs: Number(process.env.QA_RUNNER_COOLDOWN_SECONDS || 90) * 1000,
  perIpPerHour: Number(process.env.QA_RUNNER_MAX_RUNS_PER_IP_HOUR || 4),
  globalPerHour: Number(process.env.QA_RUNNER_MAX_RUNS_HOUR || 15),
  keepRuns: Number(process.env.QA_RUNNER_KEEP_RUNS || 5),
  // El VPS es compartido: no se lanza Chromium si el servidor no tiene esta memoria libre.
  minFreeMb: Number(process.env.QA_RUNNER_MIN_FREE_MB || 0)
};

const state = {
  status: 'idle', runId: null, startedAt: null, finishedAt: null,
  exitCode: null, timedOut: false, summary: null, log: []
};
const history = [];
let activeChild = null;
let killTimer = null;

function isLoopback(req) {
  const address = req.socket.remoteAddress;
  const host = req.get('host') || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)
    && !req.get('x-forwarded-for');
}

function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

// MemAvailable de Linux; en otros sistemas no se aplica la guardia.
function availableMemoryMb() {
  try {
    const match = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB/m);
    return match ? Math.floor(Number(match[1]) / 1024) : null;
  } catch {
    return null;
  }
}

function deniedMessage() {
  if (mode === 'local') {
    return 'En modo local el ejecutor solo acepta solicitudes hechas desde esta misma máquina, abriendo la página en http://127.0.0.1 o http://localhost.';
  }
  return 'El ejecutor de pruebas no está habilitado en este entorno.';
}

function allowed(req) {
  if (mode === 'public') return true;
  if (mode === 'local') return isLoopback(req);
  return false;
}

function appendLog(chunk) {
  const clean = chunk.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '\n');
  state.log.push(...clean.split('\n').filter(line => line.trim()));
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

// Distingue conformes de defectos conocidos (test.fail): Playwright cuenta ambos como "passed".
function readSummary(jsonFile) {
  try {
    const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    const summary = { conformes: 0, defectosConocidos: 0, fallidas: 0, inestables: 0, omitidas: 0 };
    const visit = suite => {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests) {
          if (test.status === 'unexpected') summary.fallidas += 1;
          else if (test.status === 'flaky') summary.inestables += 1;
          else if (test.status === 'skipped') summary.omitidas += 1;
          else if (test.expectedStatus === 'failed') summary.defectosConocidos += 1;
          else summary.conformes += 1;
        }
      }
      (suite.suites || []).forEach(visit);
    };
    report.suites.forEach(visit);
    return summary;
  } catch {
    return null;
  }
}

function pruneRuns() {
  if (!fs.existsSync(runsRoot)) return;
  const runs = fs.readdirSync(runsRoot).filter(name => /^\d{8}-\d{6}-[0-9a-f]{4}$/.test(name)).sort();
  for (const old of runs.slice(0, Math.max(0, runs.length - limits.keepRuns))) {
    fs.rmSync(path.join(runsRoot, old), { recursive: true, force: true });
  }
}

function rejectionReason(ip) {
  if (activeChild) return [409, 'Ya hay una ejecución en curso. Puedes seguir su avance en esta misma página.'];
  const now = Date.now();
  const lastFinish = state.finishedAt || 0;
  if (now - lastFinish < limits.cooldownMs) {
    const wait = Math.ceil((limits.cooldownMs - (now - lastFinish)) / 1000);
    return [429, `La última ejecución terminó hace poco. Espera ${wait} s para proteger los recursos del servidor.`];
  }
  const lastHour = history.filter(entry => now - entry.at < 3_600_000);
  history.splice(0, history.length, ...lastHour);
  if (lastHour.length >= limits.globalPerHour) return [429, 'Se alcanzó el límite de ejecuciones por hora del servidor. Intenta más tarde.'];
  if (lastHour.filter(entry => entry.ip === ip).length >= limits.perIpPerHour) {
    return [429, 'Alcanzaste el límite de ejecuciones por hora desde tu conexión.'];
  }
  const freeMb = availableMemoryMb();
  if (limits.minFreeMb && freeMb !== null && freeMb < limits.minFreeMb) {
    return [503, `El servidor tiene ${freeMb} MiB de memoria libre y la suite necesita al menos ${limits.minFreeMb} MiB. Intenta en unos minutos.`];
  }
  return null;
}

function publicState() {
  return {
    mode,
    ...state,
    reportUrl: state.runId && state.status !== 'running' ? `/revision/ejecuciones/${state.runId}/reporte/` : null,
    elapsedSeconds: state.startedAt ? Math.round(((state.finishedAt || Date.now()) - state.startedAt) / 1000) : 0,
    limits: { workers: limits.workers, timeoutSeconds: limits.timeoutMs / 1000, cooldownSeconds: limits.cooldownMs / 1000 }
  };
}

// Solo se heredan variables necesarias; secretos de la aplicación no viajan al proceso de pruebas.
function inheritedEnv() {
  const names = ['PATH', 'HOME', 'TMPDIR', 'PLAYWRIGHT_BROWSERS_PATH', 'E2E_PORT_APPROVED', 'E2E_PORT_REJECTED'];
  return Object.fromEntries(names.filter(name => process.env[name]).map(name => [name, process.env[name]]));
}

function startRun(ip) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const runId = `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
  const runDir = path.join(runsRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  history.push({ at: Date.now(), ip });

  Object.assign(state, {
    status: 'running', runId, startedAt: Date.now(), finishedAt: null,
    exitCode: null, timedOut: false, summary: null,
    log: [`Ejecución ${runId}: Playwright con ${limits.workers} worker, dos servidores aislados (riesgo aprobado y rechazado).`]
  });

  const cli = path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  // Argumentos fijos: la petición HTTP no aporta ningún parámetro al proceso.
  const child = spawn(process.execPath, [cli, 'test', `--workers=${limits.workers}`, `--output=${path.join(runDir, 'artefactos')}`], {
    cwd: projectRoot,
    detached: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...inheritedEnv(),
      CI: '1',
      FORCE_COLOR: '0',
      QA_RUN_ID: runId,
      QA_RUN_ORIGIN: mode === 'public' ? 'Página pública de la entrega' : 'Página local de la entrega',
      PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(runDir, 'reporte'),
      PLAYWRIGHT_JUNIT_OUTPUT_FILE: path.join(runDir, 'junit.xml'),
      QA_RUN_JSON: path.join(runDir, 'resultado.json')
    }
  });
  activeChild = child;
  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);

  // Apagado en dos fases: SIGINT deja que Playwright detenga sus webServer (que viven en
  // grupos de procesos propios); SIGKILL solo si no termina dentro del margen de gracia.
  killTimer = setTimeout(() => {
    state.timedOut = true;
    appendLog(`Se alcanzó el límite de ${limits.timeoutMs / 1000} s: se detiene la ejecución.`);
    try { process.kill(-child.pid, 'SIGINT'); } catch { /* el grupo ya terminó */ }
    killTimer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* el grupo ya terminó */ }
    }, 15_000);
  }, limits.timeoutMs);

  child.on('error', error => appendLog(`No fue posible iniciar Playwright: ${error.message}`));
  child.on('close', exitCode => {
    clearTimeout(killTimer);
    Object.assign(state, {
      exitCode,
      finishedAt: Date.now(),
      status: exitCode === 0 && !state.timedOut ? 'passed' : 'failed',
      summary: readSummary(path.join(runsRoot, state.runId, 'resultado.json'))
    });
    appendLog(state.status === 'passed'
      ? 'Suite conforme. Los defectos conocidos aparecen como «fallo esperado»: siguen abiertos en la aplicación.'
      : 'La suite reportó fallos. Abre el reporte de esta ejecución para ver causa, traza y video.');
    activeChild = null;
    pruneRuns();
  });
}

export function registerQualityReview(app) {
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

  app.use('/revision/ejecuciones', express.static(runsRoot, { index: 'index.html', dotfiles: 'deny' }));
  app.get('/revision/documentos/:name', (req, res) => {
    const { name } = req.params;
    if (!documents.has(name)) return res.sendStatus(404);
    return res.type('text/plain; charset=utf-8').sendFile(path.join(projectRoot, name));
  });

  app.get('/revision/estado', (req, res) => {
    if (!allowed(req)) return res.status(403).json({ mode, error: deniedMessage() });
    return res.json(publicState());
  });

  app.post('/revision/ejecutar', (req, res) => {
    if (!allowed(req)) return res.status(403).json({ mode, error: deniedMessage() });
    if (mode === 'public' && !sameOrigin(req)) return res.status(403).json({ error: 'Solicitud rechazada: origen no válido.' });
    const rejection = rejectionReason(req.ip);
    if (rejection) return res.status(rejection[0]).json({ error: rejection[1] });
    startRun(req.ip);
    return res.status(202).json(publicState());
  });
}
