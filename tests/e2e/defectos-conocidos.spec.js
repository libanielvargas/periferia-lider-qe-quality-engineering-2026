import { test, expect } from '../support/fixtures.js';
import { validClient } from '../support/data-factory.js';

// Defecto conocido y documentado en DIAGNOSTICO.md: la validación de saldo compara
// solo el monto, pero se descuenta monto + 10 %. test.fail() lo deja visible en el
// reporte como "expected to fail"; si el defecto se corrige, esta prueba se pone en rojo
// y obliga a retirar la marca.
test('no debe permitir que una operación aprobada deje saldo negativo', async ({ api }) => {
  test.fail(true, 'DEF-01: saldo 1000 con operación de 1000 queda en -100');

  const client = await test.step(
    'Dado: un cliente con saldo exacto de $1 000 — monto límite donde el defecto se manifiesta',
    () => api.createClient(validClient({ balance: 1000 }))
  );

  const response = await test.step(
    'Cuando: se solicita una operación de $1 000 — el sistema valida solo el monto (pasa), pero descuenta $1 100 (monto + 10 % de cargo)',
    () => api.postOperation(client.id, 1000)
  );

  const summary = await test.step(
    'Entonces: se esperaría HTTP 422 (rechazo por saldo insuficiente) y saldo ≥ $0 — pero el defecto DEF-01 permite que el saldo quede en -100',
    async () => {
      const s = await api.getSummary(client.id);
      // La siguiente verificación FALLA intencionalmente: el saldo resultante es -100.
      // Esta prueba está marcada con test.fail() para documentar el defecto,
      // NO para ocultarlo ni aprobarlo.
      expect(s.client.balance).toBeGreaterThanOrEqual(0);
      expect(response.status()).toBe(422);
      return s;
    }
  );
});
