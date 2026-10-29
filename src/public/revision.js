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

async function refresh() {
  clearTimeout(pollTimer);
  try {
    const response = await fetch('/revision/estado', { cache: 'no-store' });
    const state = await response.json();
    if (response.status === 403) {
      runButton.disabled = true;
      runPill.textContent = 'Ejecutor no habilitado en este entorno';
      runLimits.textContent = state.error;
      return;
    }
    render(state);
    if (state.status === 'running') pollTimer = setTimeout(refresh, 1200);
  } catch {
    runPill.className = 'run-pill failed';
    runPill.textContent = 'No fue posible consultar el estado del ejecutor';
  }
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  runLog.textContent = 'Solicitando la ejecución al servidor…';
  try {
    const response = await fetch('/revision/ejecutar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const body = await response.json();
    if (!response.ok) {
      runLog.textContent = body.error || 'No fue posible iniciar la ejecución.';
      runButton.disabled = false;
      return;
    }
    render(body);
    pollTimer = setTimeout(refresh, 800);
  } catch {
    runLog.textContent = 'No fue posible contactar al servidor.';
    runButton.disabled = false;
  }
});

refresh();
