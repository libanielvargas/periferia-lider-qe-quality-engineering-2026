import { defineConfig, devices } from '@playwright/test';
import { environments, baseUrl, webServerFor } from './tests/support/environments.js';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  // Sin reintentos: una prueba inestable debe verse, no ocultarse.
  retries: 0,
  workers: isCI ? 2 : undefined,
  globalTeardown: './tests/support/global-teardown.js',
  reporter: [
    ['list', { printSteps: true }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'reports/junit.xml' }]
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'riesgo-aprobado',
      testIgnore: /.*\.rejected\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: baseUrl(environments.approved) }
    },
    {
      name: 'riesgo-rechazado',
      testMatch: /.*\.rejected\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: baseUrl(environments.rejected) }
    }
  ],
  webServer: [webServerFor(environments.approved), webServerFor(environments.rejected)]
});
