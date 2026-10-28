import { test, expect } from '@playwright/test';

test('crea un cliente desde la interfaz', async ({ page }) => {
  await page.goto('/');
  await page.locator('#client-name').fill('Ana Pruebas');
  await page.locator('#client-document').fill('1020304050');
  await page.locator('#client-email').fill('ana.pruebas@example.com');
  await page.locator('#client-balance').fill('1000');
  await page.getByRole('button', { name: 'Crear cliente' }).click();
  await expect(page.locator('#client-result')).toContainText('Cliente creado');
});
