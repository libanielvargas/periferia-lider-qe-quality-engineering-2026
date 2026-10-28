import { test, expect, attachEvidence } from '../support/fixtures.js';
import { validClient, formatCurrency } from '../support/data-factory.js';

// Se ejecuta en el proyecto "rejected": servidor con RISK_MODE=rejected.
test('una operación rechazada por riesgo queda registrada y no descuenta saldo', async ({ operationsPage, api, page }, testInfo) => {
  const client = validClient();
  const clientId = await operationsPage.createClient(client);

  await operationsPage.executeOperation(clientId, 100);
  const operation = await operationsPage.operationOutcome();
  expect(operation.status).toBe('REJECTED');

  await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(client.balance), status: 'REJECTED' });

  const savedOperation = await api.getOperation(operation.id);
  expect(savedOperation).toMatchObject({ client_id: clientId, amount: 100, status: 'REJECTED' });
  const summary = await api.getSummary(clientId);
  expect(summary.client.balance).toBe(client.balance);
  await attachEvidence(testInfo, 'operacion-rechazada', { page, json: { operation: savedOperation, summary } });
});
