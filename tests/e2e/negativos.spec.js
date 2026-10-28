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

    const clientId = await test.step(
      `Dado: un cliente con saldo insuficiente ($${client.balance}) es registrado en el sistema`,
      () => operationsPage.createClient(client)
    );

    await test.step(
      `Cuando: se intenta ejecutar una operación de $${amount} que supera el saldo disponible`,
      () => operationsPage.executeOperation(clientId, amount)
    );

    await test.step(
      'Entonces: la interfaz muestra el error "insufficient balance" y lo resalta en rojo',
      async () => {
        await expect(operationsPage.operationResult).toHaveText('insufficient balance');
        await expect(operationsPage.operationResult).toHaveClass(/error/);
      }
    );

    await test.step(
      `Y: el resumen en pantalla muestra que el saldo permanece intacto en $${formatCurrency(client.balance)} y no hay operaciones registradas`,
      async () => {
        await operationsPage.refreshSummaryButton.click();
        await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(client.balance), status: 'Sin operaciones' });
      }
    );

    const summary = await test.step(
      'Y: la API confirma que el saldo no fue modificado y el contador de operaciones es cero',
      async () => {
        const s = await api.getSummary(clientId);
        expect(s.client.balance).toBe(client.balance);
        expect(s.operationCount).toBe(0);
        return s;
      }
    );

    await attachEvidence(testInfo, 'saldo-insuficiente', { page, json: summary });
  });

  test('no permite registrar un documento duplicado', async ({ api }) => {
    const client = await test.step(
      'Dado: un cliente ya registrado con un documento específico en el sistema',
      () => api.createClient(validClient())
    );

    const response = await test.step(
      'Cuando: se intenta registrar un segundo cliente con el mismo número de documento',
      () => api.postClient(validClient({ document: client.document }))
    );

    await test.step(
      'Entonces: la API rechaza la solicitud con HTTP 409 y el mensaje "document already exists"',
      async () => {
        expect(response.status()).toBe(409);
        expect(await response.json()).toEqual({ error: 'document already exists' });
      }
    );
  });

  for (const invalid of invalidClients()) {
    test(`rechaza cliente inválido: ${invalid.case}`, async ({ api }) => {
      const response = await test.step(
        `Cuando: se envía un registro de cliente con dato inválido — ${invalid.case}`,
        () => api.postClient(invalid.payload)
      );

      await test.step(
        `Entonces: la API responde HTTP ${invalid.status} con el error "${invalid.error}"`,
        async () => {
          expect(response.status()).toBe(invalid.status);
          expect(await response.json()).toEqual({ error: invalid.error });
        }
      );
    });
  }

  for (const invalid of invalidAmounts()) {
    test(`rechaza operación inválida: ${invalid.case}`, async ({ api }) => {
      const client = await test.step(
        'Dado: un cliente válido previamente creado en el sistema',
        () => api.createClient(validClient())
      );

      const response = await test.step(
        `Cuando: se envía una operación con monto inválido — ${invalid.case} (valor: ${invalid.amount})`,
        () => api.postOperation(client.id, invalid.amount)
      );

      await test.step(
        `Entonces: la API responde HTTP ${invalid.status} con el error "${invalid.error}" y el contador de operaciones queda en cero`,
        async () => {
          expect(response.status()).toBe(invalid.status);
          expect(await response.json()).toEqual({ error: invalid.error });
          expect((await api.getSummary(client.id)).operationCount).toBe(0);
        }
      );
    });
  }

  test('rechaza operación para un cliente inexistente', async ({ api }) => {
    const response = await test.step(
      'Cuando: se envía una operación de $100 para el ID de cliente 999999, que no existe en el sistema',
      () => api.postOperation(999999, 100)
    );

    await test.step(
      'Entonces: la API responde HTTP 404 con el error "client not found"',
      async () => {
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ error: 'client not found' });
      }
    );
  });
});
