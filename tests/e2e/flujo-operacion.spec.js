import { test, expect, attachEvidence } from '../support/fixtures.js';
import { validClient, expectedBalanceAfterApproval, formatCurrency } from '../support/data-factory.js';

test.describe('Flujo completo de operación aprobada', () => {
  test('crea cliente, ejecuta operación, valida en la interfaz y confirma por API', async ({ operationsPage, api, page }, testInfo) => {
    // Regla de negocio: una operación aprobada descuenta el monto MÁS un 10 % de cargo de
    // servicio. Saldo inicial 1000, operación 100 → cargo 10 → total descontado 110 → saldo final 890.
    const client = validClient({ balance: 1000 });
    const amount = 100;
    const serviceCharge = amount * 0.1; // = 10
    const totalDeducted = amount + serviceCharge; // = 110
    const expectedBalance = expectedBalanceAfterApproval(client.balance, amount); // = 890
    expect(expectedBalance).toBe(890);

    const clientId = await test.step(
      `Dado: un cliente con saldo inicial de ${formatCurrency(client.balance)} es registrado en el sistema vía la interfaz web`,
      () => operationsPage.createClient(client)
    );

    await test.step(
      'Entonces: la interfaz confirma el cliente con sus datos y no lo preselecciona para la operación',
      async () => {
        await expect(operationsPage.clientCard).toContainText('Cliente creado');
        await expect(operationsPage.clientCard).toContainText(client.document);
        // app.js sigue completando su campo oculto (comportamiento original), pero la
        // operación solo usa el cliente que la persona elige en el selector.
        await expect(operationsPage.operationClientId).toHaveValue(String(clientId));
        await expect(operationsPage.operationClient).toHaveValue('');
      }
    );

    const operation = await test.step(
      `Cuando: se envía una operación de ${formatCurrency(amount)} — el sistema aplica cargo de servicio del 10 % (${formatCurrency(serviceCharge)}) → total descontado ${formatCurrency(totalDeducted)}`,
      async () => {
        await operationsPage.executeOperation(clientId, amount);
        return operationsPage.operationOutcome();
      }
    );
    expect(operation.status).toBe('APPROVED');

    await test.step(
      `Entonces: la interfaz muestra estado APPROVED y saldo resultante ${formatCurrency(expectedBalance)} (cálculo: ${formatCurrency(client.balance)} − ${formatCurrency(totalDeducted)} = ${formatCurrency(expectedBalance)})`,
      async () => {
        await operationsPage.expectSummary({ name: client.name, balance: formatCurrency(expectedBalance), status: 'APPROVED' });
        await expect(operationsPage.operationCard).toContainText('Operación aprobada');
        await expect(operationsPage.operationCard).toContainText(client.name);
        await expect(operationsPage.history).toContainText('1 operación');
      }
    );

    const evidence = await test.step(
      `Y: la API confirma el registro completo: operación con referencia externa UUID, saldo ${formatCurrency(expectedBalance)} y contador de operaciones igual a 1`,
      async () => {
        const savedOperation = await api.getOperation(operation.id);
        expect(savedOperation).toMatchObject({ id: operation.id, client_id: clientId, amount, status: 'APPROVED' });
        expect(savedOperation.external_reference).toMatch(/^[0-9a-f-]{36}$/);

        const summary = await api.getSummary(clientId);
        expect(summary.client).toMatchObject({ document: client.document, email: client.email, balance: expectedBalance });
        expect(summary.operationCount).toBe(1);
        expect(summary.operations[0].id).toBe(operation.id);
        return { operation: savedOperation, summary };
      }
    );

    await attachEvidence(testInfo, 'resultado-operacion-aprobada', { page, json: evidence });
  });
});
