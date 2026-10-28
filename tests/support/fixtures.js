import { test as base, expect } from '@playwright/test';
import { OperationsPage } from '../pages/operations-page.js';
import { ApiClient } from './api-client.js';

export const test = base.extend({
  operationsPage: async ({ page }, use) => {
    const operationsPage = new OperationsPage(page);
    await operationsPage.open();
    await use(operationsPage);
  },
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  }
});

export async function attachEvidence(testInfo, name, { page, json }) {
  if (page) {
    await testInfo.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  if (json) {
    await testInfo.attach(`${name}.json`, { body: JSON.stringify(json, null, 2), contentType: 'application/json' });
  }
}

export { expect };
