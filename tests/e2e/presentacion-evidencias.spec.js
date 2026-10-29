import { test, expect } from '@playwright/test';

// Regresión de la presentación: la página citaba «evidencias/baseline/» como texto y esa ruta
// respondía «Cannot GET». Cada evidencia debe tener un enlace que abra un recurso real.
const contentTypes = { png: /^image\/png/, txt: /^text\/plain/, json: /^application\/json/ };
const internalPath = /^(evidencias|reports|playwright-report|runs)\//;

test.describe('Presentación de la entrega', () => {
  test('el punto de partida enlaza evidencias reales y la página no cita rutas internas sin enlace', async ({ page, request }) => {
    await page.goto('/');
    const section = page.locator('#punto-de-partida');

    const links = await test.step('Dado: la sección «Punto de partida» con su catálogo de evidencias', async () => {
      const rows = section.locator('.evidence-table tbody tr');
      expect(await rows.count()).toBeGreaterThanOrEqual(7);
      for (const row of await rows.all()) {
        await expect(row.locator('th a')).toHaveCount(1);
        await expect(row.locator('td').first()).not.toBeEmpty();
        await expect(row.locator('.state')).toHaveText(/^(Estado inicial|Intervenido)/);
      }
      const hrefs = await page.locator('a[href^="/revision/evidencias/"]').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')));
      return [...new Set(hrefs)];
    });

    await test.step('Entonces: cada enlace de evidencia responde con un recurso real del tipo esperado', async () => {
      for (const href of links) {
        const response = await request.get(href);
        expect(response.status(), href).toBe(200);
        expect(response.headers()['content-type'], href).toMatch(contentTypes[href.split('.').pop()]);
        const body = await response.body();
        expect(body.length, href).toBeGreaterThan(0);
        // La página 404 de Express es «<pre>Cannot GET …</pre>». Algunas evidencias citan ese
        // texto porque documentan el error original; por eso se busca la página, no la frase.
        expect(body.toString('utf8'), href).not.toMatch(/<pre>Cannot GET/);
      }
    });

    await test.step('Y: ninguna ruta interna aparece como texto sin enlace', async () => {
      const unlinked = await page.locator('code').evaluateAll((codes, pattern) => codes
        .filter(code => new RegExp(pattern).test(code.textContent.trim()) && !code.closest('a'))
        .map(code => code.textContent), internalPath.source);
      expect(unlinked).toEqual([]);
    });

    await test.step('Y: la carpeta citada antes ya no responde «Cannot GET», lleva al catálogo', async () => {
      const response = await request.get('/evidencias/baseline/', { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe('/#evidencias-partida');
      await page.goto('/evidencias/baseline/');
      await expect(page).toHaveURL(/\/#evidencias-partida$/);
      await expect(page.locator('#evidencias-partida')).toBeVisible();
    });

    await test.step('Y: el enlace a la carpeta completa apunta al repositorio público', async () => {
      // El servicio publicado no tiene salida a Internet: se valida el destino, no la respuesta de GitHub.
      await expect(section.locator('a[href*="github.com"]')).toHaveAttribute('href',
        'https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/tree/main/evidencias/baseline');
    });
  });
});
