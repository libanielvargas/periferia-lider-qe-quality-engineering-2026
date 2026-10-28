import { test, expect, attachEvidence } from '../support/fixtures.js';
import { validClient, formatCurrency } from '../support/data-factory.js';

// Se ejecuta en el proyecto "rejected": servidor con RISK_MODE=rejected.
test('una operación rechazada por riesgo queda registrada y no descuenta saldo', async ({ operationsPage, api, page }, testInfo) => {
  const client = validClient();

  const clientId = await test.step(
    'Dado: un cliente válido es registrado en el servidor configurado con motor de riesgo en modo "rechazar siempre" (RISK_MODE=rejected)',
    () => operationsPage.createClient(client)
  );

  const operation = await test.step(
    'Cuando: se envía una operación de $100 — el motor de riesgo la intercepta y emite veredicto REJECTED',
    async () => {
      await operationsPage.executeOperation(clientId, 100);
      return operationsPage.operationOutcome();
    }
  );
  expect(operation.status).toBe('REJECTED');

  await test.step(
    'Entonces: la interfaz muestra estado REJECTED y el saldo del cliente permanece sin cambios (el rechazo no genera cargo)',
    () => operationsPage.expectSummary({ name: client.name, balance: formatCurrency(client.balance), status: 'REJECTED' })
  );

  const evidence = await test.step(
    'Y: la API confirma que la operación quedó registrada con estado REJECTED y el saldo no fue modificado',
    async () => {
      const savedOperation = await api.getOperation(operation.id);
      expect(savedOperation).toMatchObject({ client_id: clientId, amount: 100, status: 'REJECTED' });
      const summary = await api.getSummary(clientId);
      expect(summary.client.balance).toBe(client.balance);
      return { operation: savedOperation, summary };
    }
  );

  await attachEvidence(testInfo, 'operacion-rechazada', { page, json: evidence });
});
