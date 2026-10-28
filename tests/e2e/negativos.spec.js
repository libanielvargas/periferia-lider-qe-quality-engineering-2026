import { test, expect, attachEvidence } from '../support/fixtures.js';
import {
  validClient,
  clientWithInsufficientBalance,
  invalidClients,
  invalidAmounts,
  formatCurrency
} from '../support/data-factory.js';

test.describe('Reglas de negocio negativas', () => {
  test('rechaza la operación por saldo insuficiente sin afectar el saldo', async ({ operationsPage, api, page }, testInfo) => {
    const { client, amount } = clientWithInsufficientBalance();
    const clientId = await operationsPage.createClient(client);

    await operationsPage.executeOperation(clientId, amount);
    await expect(operationsPage.operationResult).toHaveText('insufficient balance');
    await expect(operationsPage.operationResult).toHaveClass(/error/);

    await operationsPage.refreshSummaryButton.click();
    await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(client.balance), status: 'Sin operaciones' });

    const summary = await api.getSummary(clientId);
    expect(summary.client.balance).toBe(client.balance);
    expect(summary.operationCount).toBe(0);
    await attachEvidence(testInfo, 'saldo-insuficiente', { page, json: summary });
  });

  test('no permite registrar un documento duplicado', async ({ api }) => {
    const client = await api.createClient(validClient());
    const response = await api.postClient(validClient({ document: client.document }));
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: 'document already exists' });
  });

  for (const invalid of invalidClients()) {
    test(`rechaza cliente inválido: ${invalid.case}`, async ({ api }) => {
      const response = await api.postClient(invalid.payload);
      expect(response.status()).toBe(invalid.status);
      expect(await response.json()).toEqual({ error: invalid.error });
    });
  }

  for (const invalid of invalidAmounts()) {
    test(`rechaza operación inválida: ${invalid.case}`, async ({ api }) => {
      const client = await api.createClient(validClient());
      const response = await api.postOperation(client.id, invalid.amount);
      expect(response.status()).toBe(invalid.status);
      expect(await response.json()).toEqual({ error: invalid.error });
      expect((await api.getSummary(client.id)).operationCount).toBe(0);
    });
  }

  test('rechaza operación para un cliente inexistente', async ({ api }) => {
    const response = await api.postOperation(999999, 100);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'client not found' });
  });
});
