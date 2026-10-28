const clientForm = document.querySelector('#client-form');
const operationForm = document.querySelector('#operation-form');
const clientResult = document.querySelector('#client-result');
const operationResult = document.querySelector('#operation-result');
const summary = document.querySelector('#summary');
const refreshSummary = document.querySelector('#refresh-summary');
let currentClientId;

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unexpected error');
  return body;
}

clientForm.addEventListener('submit', async event => {
  event.preventDefault();
  clientResult.className = 'result';
  clientResult.textContent = 'Creando cliente...';
  const data = Object.fromEntries(new FormData(clientForm));
  try {
    const client = await request('/api/clients', { method: 'POST', body: JSON.stringify(data) });
    currentClientId = client.id;
    document.querySelector('#operation-client-id').value = client.id;
    clientResult.textContent = `Cliente creado con ID ${client.id}`;
  } catch (error) {
    clientResult.className = 'result error';
    clientResult.textContent = error.message;
  }
});

operationForm.addEventListener('submit', async event => {
  event.preventDefault();
  operationResult.className = 'result';
  operationResult.textContent = 'Procesando operación...';
  const data = Object.fromEntries(new FormData(operationForm));
  currentClientId = data.clientId;
  try {
    const operation = await request('/api/operations', { method: 'POST', body: JSON.stringify(data) });
    operationResult.textContent = `Operación ${operation.id}: ${operation.status}`;
    setTimeout(loadSummary, 300 + Math.floor(Math.random() * 1200));
  } catch (error) {
    operationResult.className = 'result error';
    operationResult.textContent = error.message;
  }
});

async function loadSummary() {
  if (!currentClientId) return;
  try {
    const data = await request(`/api/clients/${currentClientId}/summary`);
    const latest = data.operations[0];
    summary.className = 'summary';
    summary.innerHTML = `
      <article><span>Cliente</span><strong>${data.client.name}</strong></article>
      <article><span>Saldo</span><strong id="summary-balance">$${Number(data.client.balance).toFixed(2)}</strong></article>
      <article><span>Última operación</span><strong id="summary-status">${latest ? 'PENDING' : 'Sin operaciones'}</strong></article>
    `;
  } catch (error) {
    summary.className = 'summary empty';
    summary.textContent = error.message;
  }
}

refreshSummary.addEventListener('click', loadSummary);

fetch('/health')
  .then(response => response.json())
  .then(() => { document.querySelector('#service-status').textContent = 'Servicio disponible'; })
  .catch(() => { document.querySelector('#service-status').textContent = 'Servicio no disponible'; });
