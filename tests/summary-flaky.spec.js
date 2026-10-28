import { test, expect } from '@playwright/test';

test('muestra el estado de la última operación', async ({ page }) => {
  await page.goto('/');
  await page.locator('#operation-client-id').fill('1');
  await page.locator('#operation-amount').fill('50');
  await page.getByRole('button', { name: 'Realizar operación' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#summary-status')).toHaveText('APPROVED');
});
