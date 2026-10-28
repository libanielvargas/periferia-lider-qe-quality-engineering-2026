import { test, expect, attachEvidence } from '../support/fixtures.js';
import { validClient, expectedBalanceAfterApproval, formatCurrency } from '../support/data-factory.js';

test.describe('Flujo completo de operación aprobada', () => {
  test('crea cliente, ejecuta operación, valida en la interfaz y confirma por API', async ({ operationsPage, api, page }, testInfo) => {
    const client = validClient({ balance: 1000 });
    const amount = 100;
    // Regla observada: monto + 10 % de cargo de servicio -> 1000 - 110 = 890.
    const expectedBalance = expectedBalanceAfterApproval(client.balance, amount);
    expect(expectedBalance).toBe(890);

    const clientId = await test.step('Crear cliente desde la interfaz', () => operationsPage.createClient(client));

    await test.step('El ID del cliente queda precargado para la operación', async () => {
      await expect(operationsPage.operationClientId).toHaveValue(String(clientId));
    });

    const operation = await test.step('Ejecutar la operación', async () => {
      await operationsPage.executeOperation(clientId, amount);
      return operationsPage.operationOutcome();
    });
    expect(operation.status).toBe('APPROVED');

    await test.step('Validar resumen en la interfaz', async () => {
      await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(expectedBalance), status: 'APPROVED' });
    });

    const evidence = await test.step('Confirmar el registro por API', async () => {
      const savedOperation = await api.getOperation(operation.id);
      expect(savedOperation).toMatchObject({ id: operation.id, client_id: clientId, amount, status: 'APPROVED' });
      expect(savedOperation.external_reference).toMatch(/^[0-9a-f-]{36}$/);

      const summary = await api.getSummary(clientId);
      expect(summary.client).toMatchObject({ document: client.document, email: client.email, balance: expectedBalance });
      expect(summary.operationCount).toBe(1);
      expect(summary.operations[0].id).toBe(operation.id);
      return { operation: savedOperation, summary };
    });

    await attachEvidence(testInfo, 'resultado-operacion-aprobada', { page, json: evidence });
  });
});
