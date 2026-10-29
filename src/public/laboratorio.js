// Capa de presentación sobre la aplicación entregada. No modifica app.js ni el backend:
// observa lo que app.js escribe en pantalla y consulta la API existente para mostrarlo con
// más contexto. Nunca calcula saldos ni resultados; solo presenta lo que devuelve la API.
//
// Límite de la API: no existe un endpoint para listar o buscar clientes. Por eso el selector
// solo ofrece los clientes creados desde este navegador o agregados por su ID interno.

const storeKey = 'periferia-qe:clientes';
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const clientResult = document.querySelector('#client-result');
const operationForm = document.querySelector('#operation-form');
const operationResult = document.querySelector('#operation-result');
const hiddenClientId = document.querySelector('#operation-client-id');
const clientSelect = document.querySelector('#operation-client');
const amountInput = document.querySelector('#operation-amount');
const amountHint = document.querySelector('#operation-amount-cop');
const clientCard = document.querySelector('#client-card');
const operationCard = document.querySelector('#operation-card');
const summary = document.querySelector('#summary');
const history = document.querySelector('#history');
const addById = document.querySelector('#add-client-by-id');

const clients = new Map();
let summaryClientId = null;

const messages = {
  'name, document and email are required': 'Faltan datos: nombre, documento y correo son obligatorios.',
  'document must contain 8 to 10 digits': 'El documento debe tener entre 8 y 10 dígitos.',
  'document already exists': 'Ya existe un cliente con ese documento.',
  'client not found': 'El cliente no existe en la aplicación.',
  'amount must be greater than zero': 'El valor de la operación debe ser mayor que cero.',
  'insufficient balance': 'Saldo insuficiente. La aplicación rechaza la operación antes de consultar el servicio de riesgo y no la registra.',
  'risk validation unavailable': 'El servicio de riesgo no respondió. La operación no se registró.'
};

const statusText = { APPROVED: 'Aprobada', REJECTED: 'Rechazada' };

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fields(rows) {
  const list = element('dl', 'card-fields');
  for (const [label, value, className] of rows) {
    const row = element('div', className);
    row.append(element('dt', '', label), element('dd', '', value));
    list.append(row);
  }
  return list;
}

function showCard(container, { tone, title, lead, rows = [], action }) {
  container.replaceChildren();
  container.className = `result-card ${tone}`;
  container.append(element('p', 'card-title', title));
  if (lead) container.append(element('p', 'card-lead', lead));
  if (rows.length) container.append(fields(rows));
  if (action) container.append(action);
  container.hidden = false;
}

function money(value) {
  return Number.isFinite(Number(value)) ? cop.format(Number(value)) : 'Sin valor numérico';
}

function clientLabel(client) {
  return `${client.name} · Doc. ${client.document}`;
}

// Selector de clientes: se reconstruye sin cambiar la selección de la persona.
function saveClients() {
  try { localStorage.setItem(storeKey, JSON.stringify([...clients.keys()])); } catch { /* sin almacenamiento */ }
}

function renderOptions() {
  const selected = clientSelect.value;
  const placeholder = element('option', '', clients.size ? 'Selecciona un cliente' : 'Primero crea un cliente');
  placeholder.value = '';
  const options = [...clients.values()].map(client => {
    const option = element('option', '', clientLabel(client));
    option.value = String(client.id);
    return option;
  });
  clientSelect.replaceChildren(placeholder, ...options);
  clientSelect.value = clients.has(Number(selected)) ? selected : '';
}

function remember(client) {
  clients.set(client.id, client);
  saveClients();
  renderOptions();
}

async function restoreClients() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch { ids = []; }
  // La base puede haberse reiniciado: solo se conservan los clientes que la API todavía devuelve.
  const found = await Promise.all(ids.map(id => getJson(`/api/clients/${Number(id)}`).catch(() => null)));
  found.filter(Boolean).forEach(client => clients.set(client.id, client));
  saveClients();
  renderOptions();
}

function useClient(client) {
  const button = element('button', 'secondary card-action', 'Usar este cliente en una operación');
  button.type = 'button';
  button.addEventListener('click', () => {
    clientSelect.value = String(client.id);
    amountInput.focus();
  });
  return button;
}

// 1. Creación de clientes: app.js escribe «Cliente creado con ID n» o el error de la API.
new MutationObserver(async () => {
  const text = clientResult.textContent.trim();
  if (!text || text === 'Creando cliente...') return;
  const created = text.match(/^Cliente creado con ID (\d+)$/);
  if (!created) {
    if (clientResult.classList.contains('error')) {
      showCard(clientCard, { tone: 'error', title: 'No se creó el cliente', lead: messages[text] || text });
    }
    return;
  }
  try {
    const client = await getJson(`/api/clients/${created[1]}`);
    remember(client);
    showCard(clientCard, {
      tone: 'success',
      title: 'Cliente creado',
      lead: 'La aplicación registró el cliente. Ya puedes elegirlo en «Ejecutar operación».',
      rows: [
        ['Nombre', client.name],
        ['Documento', client.document],
        ['Correo', client.email],
        ['Saldo inicial', money(client.balance)],
        ['Registrado', client.created_at ? dateTime.format(new Date(client.created_at)) : '—']
      ],
      action: useClient(client)
    });
  } catch {
    showCard(clientCard, { tone: 'neutral', title: 'Cliente creado', lead: 'No fue posible consultar sus datos en la API.' });
  }
}).observe(clientResult, { childList: true, characterData: true, subtree: true });

// 2. Operación: el ID que envía app.js sale del selector, no del valor que app.js precarga.
// Se registra en fase de captura para ejecutarse antes del manejador de app.js.
document.addEventListener('submit', event => {
  if (event.target !== operationForm) return;
  hiddenClientId.value = clientSelect.value;
  summaryClientId = clientSelect.value;
  operationCard.hidden = true;
}, true);

amountInput.addEventListener('input', () => {
  const value = Number(amountInput.value);
  amountHint.textContent = amountInput.value && Number.isFinite(value) ? `Equivale a ${money(value)} (pesos colombianos).` : '';
});

new MutationObserver(async () => {
  const text = operationResult.textContent.trim();
  if (!text || text === 'Procesando operación...') return;
  const done = text.match(/^Operación (\d+): (APPROVED|REJECTED)$/);
  if (!done) {
    if (operationResult.classList.contains('error')) {
      showCard(operationCard, { tone: 'error', title: 'Operación no registrada', lead: messages[text] || text });
    }
    return;
  }
  try {
    const operation = await getJson(`/api/operations/${done[1]}`);
    const client = clients.get(operation.client_id) || await getJson(`/api/clients/${operation.client_id}`).catch(() => null);
    const approved = operation.status === 'APPROVED';
    showCard(operationCard, {
      tone: approved ? 'success' : 'warning',
      title: `Operación ${statusText[operation.status].toLowerCase()}`,
      lead: approved
        ? 'El servicio de riesgo aprobó la operación y la aplicación la registró.'
        : 'El servicio de riesgo rechazó la operación. La aplicación la registró como rechazada.',
      rows: [
        ['Cliente', client ? clientLabel(client) : `ID interno ${operation.client_id}`],
        ['Valor', money(operation.amount)],
        ['Estado', statusText[operation.status]],
        ['Referencia externa', operation.external_reference, 'mono'],
        ['Registrada', dateTime.format(new Date(operation.created_at))]
      ]
    });
  } catch {
    showCard(operationCard, { tone: 'neutral', title: text, lead: 'No fue posible consultar el detalle en la API.' });
  }
}).observe(operationResult, { childList: true, characterData: true, subtree: true });

// 3. Historial: la API devuelve todas las operaciones del cliente; el resumen original solo
// muestra la última. Se presenta el historial tal como lo devuelve la API.
function historyTable(operations) {
  const table = element('table', 'history-table');
  const head = element('tr');
  ['N.º', 'Registrada', 'Valor', 'Estado', 'Referencia externa'].forEach(label => head.append(element('th', '', label)));
  table.append(element('thead'), element('tbody'));
  table.tHead.append(head);
  for (const operation of operations) {
    const row = element('tr');
    row.append(
      element('td', '', String(operation.id)),
      element('td', '', dateTime.format(new Date(operation.created_at))),
      element('td', 'num', money(operation.amount)),
      element('td', `op-status ${operation.status.toLowerCase()}`, statusText[operation.status] || operation.status),
      element('td', 'mono', operation.external_reference)
    );
    table.tBodies[0].append(row);
  }
  const wrap = element('div', 'history-scroll');
  wrap.append(table);
  return wrap;
}

async function renderHistory() {
  if (!summaryClientId || !summary.querySelector('#summary-balance')) {
    history.hidden = true;
    return;
  }
  try {
    const data = await getJson(`/api/clients/${summaryClientId}/summary`);
    const balance = Number(data.client.balance);
    const header = element('div', 'history-head');
    header.append(
      element('p', 'card-title', `Historial de ${data.client.name} · ${data.operationCount} ${data.operationCount === 1 ? 'operación' : 'operaciones'}`),
      element('p', `history-balance${balance < 0 ? ' negative' : ''}`, `Saldo según la API: ${money(balance)}`)
    );
    history.replaceChildren(header);
    if (data.operations.length) history.append(historyTable(data.operations));
    history.append(element('p', 'history-note',
      'Fuente: GET /api/clients/:id/summary. El resumen original de la aplicación muestra solo la última operación; la API devuelve el historial completo.'));
    history.hidden = false;
  } catch {
    history.hidden = true;
  }
}

new MutationObserver(renderHistory).observe(summary, { childList: true });

// Agregar un cliente existente por su ID interno (la API no permite buscar por documento).
addById.addEventListener('submit', async event => {
  event.preventDefault();
  const input = addById.querySelector('input');
  const note = addById.querySelector('.add-note');
  try {
    const client = await getJson(`/api/clients/${Number(input.value)}`);
    remember(client);
    clientSelect.value = String(client.id);
    note.textContent = `Agregado: ${clientLabel(client)}.`;
    input.value = '';
  } catch {
    note.textContent = 'La API no encontró un cliente con ese ID.';
  }
});

restoreClients();
