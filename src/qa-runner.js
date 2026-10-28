import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const reportRoot = path.join(projectRoot, 'playwright-report');
const documents = new Set(['DIAGNOSTICO.md', 'DECISIONES.md', 'REVISION_PR.md', 'CAMBIOS.md']);
const state = { status: 'idle', startedAt: null, finishedAt: null, exitCode: null, timedOut: false, log: [] };
let activeChild = null;

function localRequest(req) {
  const address = req.socket.remoteAddress;
  const host = req.get('host') || '';
  const sameOrigin = !req.get('origin') || req.get('origin') === `http://${host}`;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)
    && !req.get('x-forwarded-for') && !req.get('x-forwarded-host')
    && sameOrigin && !process.env.CI && process.env.NODE_ENV !== 'production';
}

function appendLog(chunk) {
  const clean = chunk.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '\n');
  state.log.push(...clean.split('\n').filter(Boolean));
  if (state.log.length > 180) state.log.splice(0, state.log.length - 180);
}

export function registerQualityReview(app) {
  app.use('/revision/reporte', express.static(reportRoot, { index: 'index.html' }));
  app.get('/revision/documentos/:name', (req, res) => {
    const { name } = req.params;
    if (!documents.has(name)) return res.sendStatus(404);
    return res.type('text/plain; charset=utf-8').sendFile(path.join(projectRoot, name));
  });

  app.get('/revision/status', (req, res) => {
    if (!localRequest(req)) return res.status(403).json({ error: 'Ejecutor disponible solo en localhost.' });
    return res.json({
      ...state,
      elapsedSeconds: state.startedAt
        ? Math.round(((state.finishedAt || Date.now()) - state.startedAt) / 1000)
        : 0
    });
  });

  app.post('/revision/ejecutar', (req, res) => {
    if (!localRequest(req)) return res.status(403).json({ error: 'Por seguridad, ejecútalo desde localhost en la Mac.' });
    if (activeChild) return res.status(409).json({ error: 'Ya hay una ejecución activa.' });

    Object.assign(state, {
      status: 'running',
      startedAt: Date.now(),
      finishedAt: null,
      exitCode: null,
      timedOut: false,
      log: ['Iniciando Playwright: dos ambientes de riesgo con bases de datos aisladas.']
    });

    const cli = path.join(projectRoot, 'node_modules', 'playwright', 'cli.js');
    const child = spawn(process.execPath, [cli, 'test', '--reporter=list'], {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });
    activeChild = child;
    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);

    const limit = setTimeout(() => {
      state.timedOut = true;
      appendLog('Se agotó el límite de 150 segundos: se detiene la ejecución.');
      child.kill('SIGTERM');
    }, 150_000);
    child.on('error', error => appendLog(`Error al ejecutar la suite: ${error.message}`));
    child.on('close', exitCode => {
      clearTimeout(limit);
      state.exitCode = exitCode;
      state.finishedAt = Date.now();
      state.status = exitCode === 0 && !state.timedOut ? 'passed' : 'failed';
      appendLog(state.status === 'passed'
        ? 'Suite finalizada: revisa también el defecto conocido marcado como fallo esperado.'
        : 'La ejecución falló. Abre el reporte para ver las causas.');
      activeChild = null;
    });
    res.status(202).json({ started: true });
  });
}
