import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { dataRules } from '../support/data-rules.js';

// Las vistas /retos/* deben mostrar lo mismo que sus fuentes canónicas. Esta prueba lee las
// fuentes por su cuenta (sin usar el código que genera las vistas) y compara.
const read = file => fs.readFileSync(file, 'utf8');
const rows = (file, pattern) => read(file).split('\n').filter(line => pattern.test(line));
const cell = (line, index) => line.split(/(?<!\\)\|/)[index + 1].replace(/\*\*/g, '').trim();
const k6 = file => JSON.parse(read(file)).metrics.http_req_duration;
const es = value => Number(value).toLocaleString('es-CO', { maximumFractionDigits: 3 });
const views = ['diagnostico', 'datos-sinteticos', 'rendimiento', 'revision-pr'];

test.describe('Presentación de la entrega', () => {
  test('las vistas de los retos 1, 3, 4 y 6 reflejan sus fuentes y comparten encabezado y pie', async ({ page, request }) => {
    const shared = await test.step('Dado: el encabezado y el pie de la portada', async () => {
      await page.goto('/');
      await expect(page.locator('.challenge-list > li')).toHaveCount(6);
      return {
        footer: await page.locator('.site-footer').innerHTML(),
        nav: await page.locator('.top-nav a').evaluateAll(links => links.map(a => a.textContent))
      };
    });

    await test.step('Entonces: cada tarjeta de la portada lleva a su vista y a su fuente original', async () => {
      for (const slug of views) {
        const card = page.locator('.challenge-list > li').filter({ has: page.locator(`a[href="/retos/${slug}"]`) });
        await expect(card).toHaveCount(1);
        await expect(card.locator('.challenge-sources a').first()).toHaveAttribute('href', /.+/);
      }
    });

    await test.step('Y: las cuatro vistas reutilizan el mismo encabezado y pie, y permiten volver a los seis retos', async () => {
      for (const slug of views) {
        await page.goto(`/retos/${slug}`);
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.locator('.site-footer').innerHTML()).toBe(shared.footer);
        expect(await page.locator('.top-nav a').evaluateAll(links => links.map(a => a.textContent))).toEqual(shared.nav);
        await expect(page.locator('.breadcrumb a')).toHaveAttribute('href', '/#retos');
        await expect(page.locator('.retos-nav a')).toHaveCount(6);
      }
    });

    await test.step('Y: el diagnóstico muestra los 13 hallazgos con la prioridad del documento', async () => {
      const findings = rows('DIAGNOSTICO.md', /^\| P\d \|/);
      expect(findings).toHaveLength(13);
      await page.goto('/retos/diagnostico');
      await expect(page.locator('.finding')).toHaveCount(findings.length);
      expect(await page.locator('.finding .prio').allTextContents()).toEqual(findings.map(line => cell(line, 0)));
      // Cada código de evidencia (E1, E2…) de la tabla se presenta como enlace a su archivo.
      const codes = findings.map(line => cell(line, 5).match(/E\d+/g).length);
      for (const [i, count] of codes.entries()) {
        await expect(page.locator('.finding').nth(i).locator('.finding-fields div:last-child a')).toHaveCount(count);
      }
    });

    await test.step('Y: la revisión del PR muestra los 9 hallazgos, su severidad, la decisión y el archivo revisado', async () => {
      const findings = rows('REVISION_PR.md', /^\| \d+ \|/);
      expect(findings).toHaveLength(9);
      await page.goto('/retos/revision-pr');
      await expect(page.locator('.finding')).toHaveCount(findings.length);
      expect(await page.locator('.finding .sev').allTextContents()).toEqual(findings.map(line => cell(line, 2)));
      await expect(page.locator('.decision-banner strong')).toHaveText('SOLICITAR CAMBIOS BLOQUEANTES');
      const lines = read('review-target/payment-helper.js').replace(/\n$/, '').split('\n');
      await expect(page.locator('.code-view tr')).toHaveCount(lines.length);
    });

    await test.step('Y: el rendimiento muestra las cifras de los resúmenes de k6 y separa local, CI y producción', async () => {
      await page.goto('/retos/rendimiento');
      const main = page.locator('main');
      for (const file of ['summary-completa-5m', 'summary-reducida-30s', 'summary-simulacion-ci-30s']) {
        await expect(main).toContainText(`${es(k6(`evidencias/performance/${file}.json`)['p(95)'])} ms`);
      }
      const ciP95 = read('evidencias/publicacion/github-actions-run-40805453568.md').match(/p95 = \*\*([\d,]+ ms)\*\*/)[1];
      await expect(main).toContainText(ciP95);
      for (const heading of ['Local', 'CI: GitHub Actions', 'Producción: el servidor de esta página']) {
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      }
    });

    await test.step('Y: los datos sintéticos muestran las reglas vigentes de data-rules.js', async () => {
      await page.goto('/retos/datos-sinteticos');
      const main = page.locator('main');
      await expect(main).toContainText(`Prefijo «${dataRules.client.documentPrefix}»`);
      await expect(main).toContainText(dataRules.client.emailDomain);
      for (const item of [...dataRules.invalidClients, ...dataRules.invalidAmounts]) {
        await expect(main.getByRole('rowheader', { name: item.case, exact: true })).toBeVisible();
      }
      await expect(main.locator('.example-card .mono').first()).toHaveText(new RegExp(`^${dataRules.client.documentPrefix}\\d{${dataRules.client.documentLength - 1}}$`));
    });

    await test.step('Y: ningún enlace interno de las vistas está roto', async () => {
      const hrefs = new Set();
      for (const slug of views) {
        await page.goto(`/retos/${slug}`);
        for (const href of await page.locator('a[href^="/"]').evaluateAll(links => links.map(a => a.getAttribute('href')))) {
          hrefs.add(href.split('#')[0] || '/');
        }
      }
      for (const href of hrefs) {
        const response = await request.get(href);
        expect(response.status(), href).toBe(200);
      }
    });
  });
});
