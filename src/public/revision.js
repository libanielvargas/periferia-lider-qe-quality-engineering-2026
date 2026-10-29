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
const runId = document.querySelector('#run-id');
const runClock = document.querySelector('#run-clock');
const runLog = document.querySelector('#run-log');
const runReport = document.querySelector('#run-report');
const runLimits = document.querySelector('#run-limits');
let pollTimer;

const labels = {
  idle: 'Sin ejecuciones desde el último reinicio',
  running: 'Ejecutando pruebas…',
  passed: 'Finalizada: suite conforme',
  failed: 'Finalizada con fallos'
};

function clock(seconds) {
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function summaryText(summary) {
  if (!summary) return '';
  const names = { conformes: 'conformes', defectosConocidos: 'defectos conocidos (fallo esperado)', fallidas: 'fallidas', inestables: 'inestables', omitidas: 'omitidas' };
  return Object.entries(summary).filter(([, value]) => value > 0).map(([key, value]) => `${value} ${names[key]}`).join(' · ');
}

function render(state) {
  runPill.className = `run-pill ${state.status}`;
  const summary = summaryText(state.summary);
  runPill.textContent = summary && state.status !== 'running' ? `${labels[state.status]} · ${summary}` : labels[state.status];
  runId.textContent = state.runId ? `ID ${state.runId}` : '';
  runClock.textContent = clock(state.elapsedSeconds || 0);
  runButton.disabled = state.status === 'running';
  runButton.textContent = state.status === 'running' ? 'Ejecutando…' : 'Ejecutar suite';
  runReport.hidden = !state.reportUrl;
  if (state.reportUrl) runReport.href = state.reportUrl;
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
  runLog.textContent = 'Solicitando la ejecución al servidor…';
  let response;
  try {
    response = await fetch('/revision/ejecutar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch {
    runLog.textContent = 'No hay conexión con el servidor de esta página.';
    runButton.disabled = false;
    return;
  }
  const body = await readJson(response);
  if (!response.ok || !body) {
    runLog.textContent = explain(response, body);
    // 409: ya hay una ejecución; se muestra su avance en lugar de un error.
    if (response.status === 409) refresh();
    else runButton.disabled = response.status === 404 || response.status === 403;
    return;
  }
  render(body);
  pollTimer = setTimeout(refresh, 800);
});

refresh();
