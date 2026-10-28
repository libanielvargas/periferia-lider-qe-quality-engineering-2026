import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('ejecuta una operación para el cliente creado anteriormente', async ({ page }) => {
  await page.goto('/');
  await page.locator('#operation-client-id').fill('2');
  await page.locator('#operation-amount').fill('100');
  await page.getByRole('button', { name: 'Realizar operación' }).click();
  await page.waitForTimeout(3000);
  await expect(page.locator('#operation-result')).toContainText('APPROVED');
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.locator('#summary-balance')).toHaveText('$900.00');
});
