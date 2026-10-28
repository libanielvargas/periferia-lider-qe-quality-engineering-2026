import { expect } from '@playwright/test';

export class OperationsPage {
  constructor(page) {
    this.page = page;
    this.serviceStatus = page.locator('#service-status');
    this.clientName = page.locator('#client-name');
    this.clientDocument = page.locator('#client-document');
    this.clientEmail = page.locator('#client-email');
    this.clientBalance = page.locator('#client-balance');
    this.createClientButton = page.getByRole('button', { name: 'Crear cliente' });
    this.clientResult = page.locator('#client-result');
    this.operationClientId = page.locator('#operation-client-id');
    this.operationAmount = page.locator('#operation-amount');
    this.executeOperationButton = page.getByRole('button', { name: 'Realizar operación' });
    this.operationResult = page.locator('#operation-result');
    this.refreshSummaryButton = page.getByRole('button', { name: 'Actualizar' });
    this.summary = page.locator('#summary');
    this.summaryBalance = page.locator('#summary-balance');
    this.summaryStatus = page.locator('#summary-status');
  }

  async open() {
    await this.page.goto('/');
    await expect(this.serviceStatus).toHaveText('Servicio disponible');
  }

  async createClient(client) {
    await this.clientName.fill(client.name);
    await this.clientDocument.fill(client.document);
    await this.clientEmail.fill(client.email);
    await this.clientBalance.fill(String(client.balance));
    await this.createClientButton.click();
    await expect(this.clientResult).toHaveText(/^Cliente creado con ID \d+$/);
    const text = await this.clientResult.textContent();
    return Number(text.match(/ID (\d+)/)[1]);
  }

  async executeOperation(clientId, amount) {
    await this.operationClientId.fill(String(clientId));
    await this.operationAmount.fill(String(amount));
    await this.executeOperationButton.click();
    await expect(this.operationResult).not.toHaveText(/^$|Procesando operación/);
  }

  async operationOutcome() {
    await expect(this.operationResult).toHaveText(/^Operación \d+: (APPROVED|REJECTED)$/);
    const [, id, status] = (await this.operationResult.textContent()).match(/^Operación (\d+): (\w+)$/);
    return { id: Number(id), status };
  }

  async expectSummary({ name, balance, status }) {
    // El frontend carga el resumen con un retardo aleatorio: se espera por condición.
    await expect(this.summary).toContainText(name);
    await expect(this.summaryBalance).toHaveText(balance);
    await expect(this.summaryStatus).toHaveText(status);
  }
}
