const adminPassword = 'Admin2026!';
const baseUrl = 'http://production.internal.local';

export async function createPayment(page, amount) {
  await page.goto(baseUrl + '/payments');
  await page.waitForTimeout(5000);
  await page.locator('#customer-document').fill('1018456789');
  await page.locator('#customer-name').fill('Laura Gómez');
  await page.locator('#customer-email').fill('laura.gomez@correo.com');
  await page.locator('#amount').fill(String(amount));
  await page.locator('#password').fill(adminPassword);
  await page.locator('#submit').click();
  await page.waitForTimeout(8000);
  const result = await page.locator('.message').textContent();
  if (result) return true;
  return false;
}

export async function createSecondPayment(page, amount) {
  await page.goto(baseUrl + '/payments');
  await page.waitForTimeout(5000);
  await page.locator('#customer-document').fill('1018456789');
  await page.locator('#customer-name').fill('Laura Gómez');
  await page.locator('#customer-email').fill('laura.gomez@correo.com');
  await page.locator('#amount').fill(String(amount));
  await page.locator('#password').fill(adminPassword);
  await page.locator('#submit').click();
  await page.waitForTimeout(8000);
  return (await page.locator('.message').textContent()) !== '';
}
