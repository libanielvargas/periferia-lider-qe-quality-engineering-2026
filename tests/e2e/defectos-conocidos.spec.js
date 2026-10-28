import { test, expect } from '../support/fixtures.js';
import { validClient } from '../support/data-factory.js';

// Defecto conocido y documentado en DIAGNOSTICO.md: la validación de saldo compara
// solo el monto, pero se descuenta monto + 10 %. test.fail() lo deja visible en el
// reporte como "expected to fail"; si el defecto se corrige, esta prueba se pone en rojo
// y obliga a retirar la marca.
test('no debe permitir que una operación aprobada deje saldo negativo', async ({ api }) => {
  test.fail(true, 'DEF-01: saldo 1000 con operación de 1000 queda en -100');
  const client = await api.createClient(validClient({ balance: 1000 }));

  const response = await api.postOperation(client.id, 1000);
  const summary = await api.getSummary(client.id);

  expect(summary.client.balance).toBeGreaterThanOrEqual(0);
  expect(response.status()).toBe(422);
});
