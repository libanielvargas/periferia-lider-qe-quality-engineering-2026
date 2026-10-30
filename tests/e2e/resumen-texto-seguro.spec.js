import { test, expect } from '../support/fixtures.js';
import { validClient, expectedBalanceAfterApproval, formatCurrency } from '../support/data-factory.js';

// Hallazgo P3 de DIAGNOSTICO.md: app.js inserta el resumen con innerHTML y el nombre sin escapar.
// La capa pública debe presentar como texto todo dato de la API, al operar y al consultar.
// Contenido inofensivo: etiquetas de formato y una imagen local que, si se interpretara como
// HTML, solo marcaría un atributo de la página.
const markup = '<em>Marca Evaluacion</em> <img src="/favicon.png" onload="document.body.dataset.sonda=\'html\'" onerror="document.body.dataset.sonda=\'html\'">';
const regions = ['#summary', '#history', '#client-card', '#operation-card', '#operation-client', '#summary-client'];

test.describe('Datos de la API presentados como texto', () => {
  test('un nombre con etiquetas HTML se muestra literal en el resumen al operar y al consultar', async ({ operationsPage, api, page }) => {
    const client = validClient({ balance: 1000, name: markup });
    const other = validClient({ balance: 500 });
    const balance = expectedBalanceAfterApproval(client.balance, 100);

    const expectOnlyText = async () => {
      await expect(page.locator(regions.map(region => `${region} em, ${region} img`).join(', '))).toHaveCount(0);
      expect(await page.evaluate(() => document.body.dataset.sonda)).toBeUndefined();
    };

    const [clientId, otherId] = await test.step('Dado: un cliente cuyo nombre contiene etiquetas HTML y otro cliente sin ellas', async () => [
      await operationsPage.createClient(client),
      await operationsPage.createClient(other)
    ]);

    await test.step('Cuando: se opera sobre el cliente con etiquetas y app.js escribe su resumen', async () => {
      const writes = Number(await operationsPage.summary.getAttribute('data-app-writes'));
      await operationsPage.executeOperation(clientId, 100);
      expect((await operationsPage.operationOutcome()).status).toBe('APPROVED');
      await expect.poll(async () => Number(await operationsPage.summary.getAttribute('data-app-writes'))).toBeGreaterThan(writes);
    });

    await test.step('Entonces: el resumen, el historial y las tarjetas muestran el nombre literal, sin interpretar HTML', async () => {
      await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(balance), status: 'APPROVED' });
      await expect(operationsPage.summary.locator('article').first().locator('strong')).toHaveText(client.name);
      await expect(operationsPage.history).toContainText(`Historial de ${client.name}`);
      await expect(operationsPage.operationCard).toContainText(client.name);
      await expectOnlyText();
    });

    await test.step('Y: al consultar otro cliente y volver con el selector, el nombre sigue siendo texto', async () => {
      await operationsPage.consultClient(otherId);
      await operationsPage.expectSummary({ name: other.name, balance: formatCurrency(other.balance), status: 'Sin operaciones' });
      await operationsPage.consultClient(clientId);
      await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(balance), status: 'APPROVED' });
      await expect(operationsPage.summary.locator('article').first().locator('strong')).toHaveText(client.name);
      await expectOnlyText();
    });

    await test.step('Y: la API conserva el nombre tal como se registró; la protección está en la presentación', async () => {
      const summary = await api.getSummary(clientId);
      expect(summary.client.name).toBe(markup);
      expect(summary.client.balance).toBe(balance);
    });
  });
});
