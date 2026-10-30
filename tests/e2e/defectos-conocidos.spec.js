import { test, expect } from '../support/fixtures.js';
import { validClient, expectedBalanceAfterApproval, formatCurrency } from '../support/data-factory.js';

// Defectos abiertos y documentados en DIAGNOSTICO.md y DEFECTOS.md. La marca de fallo esperado
// solo se activa después de comprobar que se reprodujo la condición exacta del defecto:
// - Un error de preparación, de red o un resultado distinto hace fallar la prueba (rojo).
// - Si el defecto desaparece, la prueba falla con un aviso para revisar y retirar la marca.
// - Solo con el defecto reproducido se marca test.fail() y se verifica la regla correcta, que
//   falla de forma esperada y queda visible en el reporte como «expected to fail».

// Los saldos se comparan con tolerancia de centavo: 1000 × 1,1 no es exacto en coma flotante.
const sameAmount = (a, b) => Math.abs(a - b) < 0.005;

async function operationOutcome(response) {
  return { http: response.status(), body: await response.json().catch(() => null) };
}

function markKnownDefect(id, description) {
  test.info().annotations.push({ type: 'defecto-conocido', description: `${id} reproducido: ${description}` });
  test.fail(true, `${id} reproducido: ${description}`);
}

function defectGone(id, detail) {
  throw new Error(`${id} ya no se reproduce (${detail}). Revisa la corrección y retira la marca de defecto conocido de esta prueba.`);
}

test('DEF-01 · Defecto abierto (fallo esperado): una operación aprobada no debe dejar saldo negativo', async ({ api }) => {
  const balance = 1000;
  const amount = 1000;
  const balanceWithDefect = expectedBalanceAfterApproval(balance, amount); // 1000 − 1100 = −100

  const client = await test.step(
    `Dado: un cliente con saldo exacto de ${formatCurrency(balance)}, monto límite donde el defecto se manifiesta`,
    () => api.createClient(validClient({ balance }))
  );

  const { outcome, summary } = await test.step(
    `Cuando: se solicita una operación de ${formatCurrency(amount)}; la aplicación valida solo el monto, pero descontaría ${formatCurrency(amount * 1.1)}`,
    async () => ({ outcome: await operationOutcome(await api.postOperation(client.id, amount)), summary: await api.getSummary(client.id) })
  );

  await test.step('Y: el resultado corresponde exactamente a DEF-01, a su corrección o falla la prueba', async () => {
    const reproduced = outcome.http === 201 && outcome.body?.status === 'APPROVED'
      && sameAmount(summary.client.balance, balanceWithDefect) && summary.operationCount === 1;
    const corrected = outcome.http === 422 && outcome.body?.error === 'insufficient balance'
      && summary.client.balance === balance && summary.operationCount === 0;
    if (corrected) defectGone('DEF-01', 'la operación se rechaza por saldo insuficiente y el saldo queda intacto');
    expect(reproduced, `Resultado distinto de DEF-01: HTTP ${outcome.http}, ${JSON.stringify(outcome.body)}, saldo ${summary.client.balance}`).toBe(true);
    markKnownDefect('DEF-01', `operación de ${amount} aprobada con saldo ${balance}; saldo final ${summary.client.balance}`);
  });

  await test.step(
    'Entonces: se esperaría HTTP 422 y saldo ≥ $ 0; con DEF-01 la operación se aprueba y el saldo queda en -$ 100',
    () => {
      expect(summary.client.balance, 'DEF-01: saldo negativo tras una operación aprobada').toBeGreaterThanOrEqual(0);
      expect(outcome.http).toBe(422);
    }
  );
});

test('DEF-02 · Defecto abierto (fallo esperado): operaciones simultáneas no deben superar el saldo (doble gasto)', async ({ api }) => {
  const balance = 100;
  const amount = 90;
  const attempts = 5;

  const client = await test.step(
    `Dado: un cliente con saldo de ${formatCurrency(balance)}, suficiente para una sola operación de ${formatCurrency(amount)}`,
    () => api.createClient(validClient({ balance }))
  );

  const { outcomes, summary } = await test.step(
    `Cuando: llegan al mismo tiempo ${attempts} operaciones de ${formatCurrency(amount)} para ese cliente`,
    async () => {
      const responses = await Promise.all(Array.from({ length: attempts }, () => api.postOperation(client.id, amount)));
      return { outcomes: await Promise.all(responses.map(operationOutcome)), summary: await api.getSummary(client.id) };
    }
  );

  const approved = outcomes.filter(item => item.http === 201 && item.body?.status === 'APPROVED').length;
  await test.step('Y: el resultado corresponde exactamente a DEF-02, a su corrección o falla la prueba', async () => {
    // Cada respuesta debe ser una aprobación o un rechazo por saldo insuficiente; cualquier otra
    // (por ejemplo, el servicio de riesgo caído) no es este defecto.
    const expectedKinds = outcomes.every(item => (item.http === 201 && item.body?.status === 'APPROVED')
      || (item.http === 422 && item.body?.error === 'insufficient balance'));
    const consistentBalance = sameAmount(summary.client.balance, expectedBalanceAfterApproval(balance, amount * approved))
      && summary.operationCount === approved;
    if (expectedKinds && consistentBalance && approved <= 1) {
      defectGone('DEF-02', `${approved} aprobada y saldo ${summary.client.balance}`);
    }
    expect(expectedKinds && consistentBalance && approved > 1,
      `Resultado distinto de DEF-02: ${JSON.stringify(outcomes)}, saldo ${summary.client.balance}, operaciones ${summary.operationCount}`).toBe(true);
    markKnownDefect('DEF-02', `${approved} de ${attempts} operaciones aprobadas; saldo final ${summary.client.balance}`);
  });

  await test.step(
    'Entonces: se esperaría como máximo una operación aprobada y saldo ≥ $ 0; con DEF-02 se aprueban varias y el saldo queda negativo',
    () => {
      expect(summary.client.balance, 'DEF-02: el saldo quedó negativo por operaciones simultáneas').toBeGreaterThanOrEqual(0);
      expect(approved).toBeLessThanOrEqual(1);
    }
  );
});
