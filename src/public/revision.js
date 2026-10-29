// Capa de presentación de la entrega: hero y ejecutor de la suite.
// Muestra el estado real del servidor; nunca resultados precargados.

// Hero: carrusel de fondo. Cada escena aparece solo si su imagen carga; sin imágenes queda el fondo oscuro.
const hero = document.querySelector('.hero');
const slides = [...document.querySelectorAll('.hero-slide[data-image]')];
const scenes = [...document.querySelectorAll('.hero-scene')];
const slideMs = 7000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeSlide = 0;
let slideTimer;

hero.style.setProperty('--slide-ms', `${slideMs}ms`);
hero.classList.toggle('is-static', reducedMotion);

function showSlide(index) {
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === activeSlide));
  scenes.forEach((scene, i) => {
    scene.classList.toggle('is-active', i === activeSlide);
    scene.setAttribute('aria-pressed', String(i === activeSlide));
  });
}

function schedule() {
  clearTimeout(slideTimer);
  if (reducedMotion || document.hidden) return;
  slideTimer = setTimeout(() => { showSlide(activeSlide + 1); schedule(); }, slideMs);
}

for (const slide of slides) {
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('load', () => {
    slide.style.backgroundImage = `url("${slide.dataset.image}")`;
    slide.classList.add('is-loaded');
  });
  image.src = slide.dataset.image;
}

scenes.forEach((scene, i) => scene.addEventListener('click', () => { showSlide(i); schedule(); }));
document.addEventListener('visibilitychange', schedule);
schedule();

const runButton = document.querySelector('#run-suite');
const runPill = document.querySelector('#run-pill');
const runProgress = document.querySelector('#run-progress');
const runResults = document.querySelector('#run-results');
const runId = document.querySelector('#run-id');
const runClock = document.querySelector('#run-clock');
const kpiStatus = document.querySelector('#kpi-status');
const kpiPass = document.querySelector('#kpi-pass');
const kpiKnown = document.querySelector('#kpi-known');
const kpiFail = document.querySelector('#kpi-fail');
const scenarioBody = document.querySelector('#run-scenarios tbody');
const runLog = document.querySelector('#run-log');
const runReport = document.querySelector('#run-report');
const runLimits = document.querySelector('#run-limits');
let pollTimer;
let renderedScenarios = '';

const labels = {
  idle: 'Sin ejecuciones desde el último reinicio',
  running: 'Ejecutando pruebas…',
  passed: 'Finalizada: suite conforme',
  failed: 'Finalizada con fallos'
};
const shortLabels = { running: 'En curso', passed: 'Conforme', failed: 'Con fallos' };
const outcomes = {
  conforme: 'Conforme',
  defecto: 'Defecto conocido (fallo esperado)',
  fallida: 'Fallo inesperado',
  inestable: 'Inestable',
  omitida: 'Omitida'
};

function clock(seconds) {
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function duration(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s`;
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

// Avance durante la ejecución: Playwright anuncia el total y marca cada escenario terminado.
function progress(log) {
  const total = log.map(line => line.match(/Running (\d+) tests?/)).find(Boolean)?.[1];
  const done = log.filter(line => /^\s*[✓✘-]\s+\d+\s+\[/.test(line)).length;
  return total ? `${done} de ${total} escenarios terminados` : 'Preparando los servidores de prueba…';
}

function scenarioRow(test, reportUrl) {
  const row = node('tr');
  const name = node('td', 'scenario-name');
  name.append(node('strong', '', test.title), node('span', '', [test.project, test.file, test.group].filter(Boolean).join(' · ')));
  const result = node('td');
  result.append(node('span', `outcome ${test.outcome}`, outcomes[test.outcome] || test.outcome));
  const evidence = node('td');
  if (test.steps.length) {
    const steps = node('details');
    steps.append(node('summary', '', `${test.steps.length} ${test.steps.length === 1 ? 'paso' : 'pasos'}`));
    const list = node('ol');
    for (const step of test.steps) list.append(node('li', step.failed ? 'failed' : '', `${step.title} (${duration(step.durationMs)})`));
    steps.append(list);
    evidence.append(steps);
  }
  if (test.attachments.length) evidence.append(node('p', 'attachments', `Adjuntos: ${test.attachments.join(', ')}`));
  if (reportUrl) {
    const link = node('a', 'report-link', 'Ver en el reporte');
    link.href = `${reportUrl}#?testId=${encodeURIComponent(test.id)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    evidence.append(link);
  }
  row.append(name, result, node('td', 'num', duration(test.durationMs)), evidence);
  return row;
}

function render(state) {
  const running = state.status === 'running';
  const summary = state.summary;
  runPill.className = `run-pill ${state.status}`;
  runPill.textContent = labels[state.status];
  runProgress.textContent = running ? progress(state.log || []) : '';
  runButton.disabled = running;
  runButton.textContent = running ? 'Ejecutando…' : 'Ejecutar suite';

  runResults.hidden = !state.runId;
  runId.textContent = state.runId || '—';
  runClock.textContent = clock(state.elapsedSeconds || 0);
  kpiStatus.textContent = shortLabels[state.status] || '—';
  kpiPass.textContent = summary ? summary.conformes : '—';
  kpiKnown.textContent = summary ? summary.defectosConocidos : '—';
  const unexpected = summary ? summary.fallidas + summary.inestables : null;
  kpiFail.textContent = summary ? unexpected : '—';
  kpiFail.parentElement.classList.toggle('has-fail', Boolean(unexpected));

  runReport.hidden = !state.reportUrl;
  if (state.reportUrl) runReport.href = state.reportUrl;

  const tests = state.tests || [];
  const key = `${state.runId}:${tests.length}`;
  if (key !== renderedScenarios) {
    renderedScenarios = key;
    scenarioBody.replaceChildren(...tests.map(test => scenarioRow(test, state.reportUrl)));
    scenarioBody.closest('.table-scroll').hidden = !tests.length;
  }

  if (state.log?.length) {
    runLog.textContent = state.log.join('\n');
    runLog.scrollTop = runLog.scrollHeight;
  }
}

// Cada falla se explica por su causa: sin red, servidor sin ejecutor (404), acceso denegado (403)
// o error del servidor. Una respuesta que no es JSON también indica un servidor que no es el esperado.
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function explain(response, body) {
  if (response.status === 404 || !body) {
    return 'Este servidor no tiene el ejecutor de pruebas. Suele pasar cuando el proceso de Node se inició con una versión anterior del código: detenlo y vuelve a iniciarlo con «npm start».';
  }
  if (response.status === 403) return body.error;
  return body.error || `El servidor respondió con el código HTTP ${response.status}.`;
}

function showUnavailable(message) {
  runPill.className = 'run-pill failed';
  runPill.textContent = 'Ejecutor no disponible';
  runLimits.textContent = message;
  runButton.disabled = true;
}

let failedPolls = 0;

async function refresh() {
  clearTimeout(pollTimer);
  let response;
  try {
    response = await fetch('/revision/estado', { cache: 'no-store' });
  } catch {
    // Durante una ejecución, un corte breve no detiene la suite: se reintenta.
    failedPolls += 1;
    if (runPill.classList.contains('running') && failedPolls <= 5) {
      pollTimer = setTimeout(refresh, 2000 * failedPolls);
      return;
    }
    showUnavailable('No hay conexión con el servidor de esta página. Verifica que siga en ejecución y recarga.');
    return;
  }
  failedPolls = 0;
  const body = await readJson(response);
  if (!response.ok || !body) {
    showUnavailable(explain(response, body));
    return;
  }
  render(body);
  if (body.status === 'running') pollTimer = setTimeout(refresh, 1200);
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  runProgress.textContent = 'Solicitando la ejecución al servidor…';
  let response;
  try {
    response = await fetch('/revision/ejecutar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch {
    runProgress.textContent = 'No hay conexión con el servidor de esta página.';
    runButton.disabled = false;
    return;
  }
  const body = await readJson(response);
  if (!response.ok || !body) {
    runProgress.textContent = explain(response, body);
    // 409: ya hay una ejecución; se muestra su avance en lugar de un error.
    if (response.status === 409) refresh();
    else runButton.disabled = response.status === 404 || response.status === 403;
    return;
  }
  render(body);
  pollTimer = setTimeout(refresh, 800);
});

refresh();
