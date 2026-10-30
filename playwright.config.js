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
  // El ejecutor de la página asigna carpeta e ID propios a cada corrida.
  metadata: process.env.QA_RUN_ID
    ? { 'ID de ejecución': process.env.QA_RUN_ID, 'Origen': process.env.QA_RUN_ORIGIN }
    : {},
  reporter: [
    ['list', { printSteps: true }],
    ['html', {
      open: 'never',
      outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report',
      title: process.env.QA_RUN_ID
        ? `Ejecución ${process.env.QA_RUN_ID} · ${process.env.QA_RUN_ORIGIN} · DEF-01 y DEF-02 son defectos abiertos (fallo esperado)`
        : 'Suite Líder QE · DEF-01 y DEF-02 son defectos abiertos (fallo esperado)'
    }],
    ['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE || 'reports/junit.xml' }],
    ...(process.env.QA_RUN_JSON ? [['json', { outputFile: process.env.QA_RUN_JSON }]] : [])
  ],
  // Solo en fallos, en cualquier origen. La captura adicional de pruebas exitosas depende del
  // origen: ver attachEvidence() en tests/support/fixtures.js.
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
