import { test, expect } from '../support/fixtures.js';
import { validClient } from '../support/data-factory.js';

// Defecto conocido y documentado en DIAGNOSTICO.md: la validación de saldo compara
// solo el monto, pero se descuenta monto + 10 %. test.fail() lo deja visible en el
// reporte como "expected to fail"; si el defecto se corrige, esta prueba se pone en rojo
// y obliga a retirar la marca.
test('DEF-01 · Defecto abierto (fallo esperado): una operación aprobada no debe dejar saldo negativo', async ({ api }) => {
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

// Defecto conocido DEF-02: el saldo se valida antes de esperar al servicio de riesgo
// (150–1050 ms), así que solicitudes simultáneas ven el mismo saldo y todas se aprueban.
test('DEF-02 · Defecto abierto (fallo esperado): operaciones simultáneas no deben superar el saldo (doble gasto)', async ({ api }) => {
  test.fail(true, 'DEF-02: saldo 100 con cinco operaciones simultáneas de 90 termina en negativo');

  const client = await test.step(
    'Dado: un cliente con saldo de $100, suficiente para una sola operación de $90',
    () => api.createClient(validClient({ balance: 100 }))
  );

  const responses = await test.step(
    'Cuando: llegan al mismo tiempo cinco operaciones de $90 para ese cliente',
    () => Promise.all(Array.from({ length: 5 }, () => api.postOperation(client.id, 90)))
  );

  await test.step(
    'Entonces: se esperaría como máximo una operación aprobada y saldo ≥ $0 — el defecto DEF-02 aprueba varias y deja saldo negativo',
    async () => {
      const approved = (await Promise.all(responses.map(response => response.json())))
        .filter(operation => operation.status === 'APPROVED');
      const summary = await api.getSummary(client.id);
      // Falla intencionalmente mientras el defecto exista; test.fail() lo deja visible.
      expect(summary.client.balance).toBeGreaterThanOrEqual(0);
      expect(approved.length).toBeLessThanOrEqual(1);
    }
  );
});
