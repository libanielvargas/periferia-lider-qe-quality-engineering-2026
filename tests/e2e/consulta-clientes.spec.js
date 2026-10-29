import { test, expect } from '../support/fixtures.js';
import { validClient, expectedBalanceAfterApproval, formatCurrency } from '../support/data-factory.js';

// Regresión: «3. Consultar resultado» solo mostraba al cliente de la última operación.
// La consulta debe poder alternar entre clientes sin ejecutar operaciones nuevas.
test.describe('Consulta de resultados entre clientes', () => {
  test('alterna la consulta entre dos clientes y conserva la selección al operar sobre otro', async ({ operationsPage, api, page }) => {
    const first = validClient({ balance: 1000 });
    const second = validClient({ balance: 500 });
    const firstBalance = expectedBalanceAfterApproval(first.balance, 100); // 1000 − 110 = 890
    const secondBalance = expectedBalanceAfterApproval(second.balance, 50); // 500 − 55 = 445

    const [firstId, secondId] = await test.step('Dado: dos clientes registrados desde la interfaz', async () => [
      await operationsPage.createClient(first),
      await operationsPage.createClient(second)
    ]);

    await test.step('Cuando: se opera sobre el primero, la consulta adopta ese cliente', async () => {
      await operationsPage.executeOperation(firstId, 100);
      expect((await operationsPage.operationOutcome()).status).toBe('APPROVED');
      await operationsPage.expectSummary({ name: first.name, balance: formatCurrency(firstBalance), status: 'APPROVED' });
      await expect(operationsPage.summaryClient).toHaveValue(String(firstId));
    });

    await test.step('Y: una operación sobre el segundo cliente no cambia la consulta elegida', async () => {
      const writes = Number(await operationsPage.summary.getAttribute('data-app-writes'));
      await operationsPage.executeOperation(secondId, 50);
      expect((await operationsPage.operationOutcome()).status).toBe('APPROVED');
      // Se espera a que app.js escriba el resumen del cliente operado antes de comprobar.
      await expect.poll(async () => Number(await operationsPage.summary.getAttribute('data-app-writes'))).toBeGreaterThan(writes);
      await expect(operationsPage.summaryClient).toHaveValue(String(firstId));
      await operationsPage.expectSummary({ name: first.name, balance: formatCurrency(firstBalance), status: 'APPROVED' });
    });

    await test.step('Entonces: el selector alterna entre clientes con saldo e historial propios', async () => {
      await operationsPage.consultClient(secondId);
      await operationsPage.expectSummary({ name: second.name, balance: formatCurrency(secondBalance), status: 'APPROVED' });
      await expect(operationsPage.history).toContainText(`Historial de ${second.name} · 1 operación`);

      await operationsPage.consultClient(firstId);
      await operationsPage.expectSummary({ name: first.name, balance: formatCurrency(firstBalance), status: 'APPROVED' });
      await expect(operationsPage.history).toContainText(`Historial de ${first.name} · 1 operación`);
    });

    await test.step('Y: «Actualizar» consulta el cliente elegido, no el de la última operación', async () => {
      const summaryRequest = page.waitForResponse(response => response.url().endsWith(`/api/clients/${firstId}/summary`));
      await operationsPage.refreshSummaryButton.click();
      await summaryRequest;
      await operationsPage.expectSummary({ name: first.name, balance: formatCurrency(firstBalance), status: 'APPROVED' });
    });

    await test.step('Y: la API confirma los saldos y el número de operaciones de cada cliente', async () => {
      const [firstSummary, secondSummary] = await Promise.all([api.getSummary(firstId), api.getSummary(secondId)]);
      expect(firstSummary.client.balance).toBe(firstBalance);
      expect(firstSummary.operationCount).toBe(1);
      expect(secondSummary.client.balance).toBe(secondBalance);
      expect(secondSummary.operationCount).toBe(1);
    });
  });
});
