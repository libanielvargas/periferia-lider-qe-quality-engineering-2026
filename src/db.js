import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(here, 'data', 'quality-lab.json');
const databasePath = process.env.DATABASE_PATH || defaultPath;

const initialState = () => ({
  clients: [
    {
      id: 1,
      name: 'Cliente Demostración',
      document: '9001234567',
      email: 'demo@example.test',
      balance: 1000,
      created_at: new Date().toISOString()
    }
  ],
  operations: []
});

function readState() {
  return JSON.parse(fs.readFileSync(databasePath, 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(databasePath, JSON.stringify(state, null, 2));
}

export function initializeDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (!fs.existsSync(databasePath)) writeState(initialState());
}

export function resetDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  writeState(initialState());
}

export function createClient(input) {
  const state = readState();
  if (state.clients.some(client => client.document === input.document)) {
    const error = new Error('document already exists');
    error.code = 'DUPLICATE_DOCUMENT';
    throw error;
  }
  const client = {
    id: Math.max(0, ...state.clients.map(item => item.id)) + 1,
    ...input,
    created_at: new Date().toISOString()
  };
  state.clients.push(client);
  writeState(state);
  return client;
}

export function findClient(id) {
  return readState().clients.find(client => client.id === Number(id));
}

export function createOperation(input) {
  const state = readState();
  const operation = {
    id: Math.max(0, ...state.operations.map(item => item.id)) + 1,
    ...input,
    created_at: new Date().toISOString()
  };
  state.operations.push(operation);
  writeState(state);
  return operation;
}

export function updateClientBalance(id, debit) {
  const state = readState();
  const client = state.clients.find(item => item.id === Number(id));
  if (!client) return;
  client.balance -= debit;
  writeState(state);
}

export function findOperation(id) {
  return readState().operations.find(operation => operation.id === Number(id));
}

export function getClientSummary(id) {
  const state = readState();
  const client = state.clients.find(item => item.id === Number(id));
  if (!client) return undefined;
  const operations = state.operations
    .filter(operation => operation.client_id === Number(id))
    .sort((a, b) => b.id - a.id);
  return { client, operations, operationCount: operations.length };
}
