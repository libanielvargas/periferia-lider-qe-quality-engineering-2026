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

// Evidencias visuales según el origen de la ejecución. Capturas, videos y trazas de fallos
// los conserva siempre Playwright (playwright.config.js). Además:
// - GitHub Actions: ninguna captura de pruebas exitosas; el reporte HTML del pipeline solo
//   lleva adjuntos visuales de fallos. Los pasos y el JSON del resultado siguen presentes.
// - Ejecutor web (QA_RUN_ID) y equipo local: una captura del resultado, que es la evidencia
//   visual que consulta el evaluador en la página pública.
// Ambos orígenes definen CI; GITHUB_ACTIONS solo existe en el pipeline, porque el ejecutor
// web filtra el entorno del proceso de pruebas (src/qa-runner.js).
export const evidenceOrigin = process.env.QA_RUN_ID ? 'ejecutor-web'
  : process.env.GITHUB_ACTIONS === 'true' ? 'pipeline' : 'local';

export async function attachEvidence(testInfo, name, { page, json }) {
  if (page && evidenceOrigin !== 'pipeline') {
    await testInfo.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  if (json) {
    await testInfo.attach(`${name}.json`, { body: JSON.stringify(json, null, 2), contentType: 'application/json' });
  }
}

export { expect };
