import { test, expect } from '@playwright/test';

test('consulta por API la operación 1', async ({ request }) => {
  const response = await request.get('/api/operations/1');
  expect(response.ok()).toBeTruthy();
  const operation = await response.json();
  expect(operation.status).toBe('APPROVED');
});
