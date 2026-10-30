// Comprueba que DIAGNOSTICO.md cabe en una página A4 legible: lo convierte a HTML, lo imprime
// con Chromium (márgenes de 12 mm, texto de 10 pt y tabla de 9 pt) y falla si ocupa más de una
// página o si algún contenido queda recortado a lo ancho.
// Uso: node scripts/diagnostico-a4.mjs [salida.pdf]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { markdown } from '../src/retos.js';

const output = process.argv[2] || 'evidencias/diagnostico/diagnostico-a4.pdf';
const css = `
  @page { size: A4; margin: 12mm; }
  body { font: 10pt/1.3 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 6pt; }
  p { margin: 0 0 6pt; }
  code { font: 8.5pt ui-monospace, Menlo, Consolas, monospace; background: #f2f2f2; padding: 0 2px; overflow-wrap: anywhere; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; line-height: 1.2; margin: 0 0 6pt; }
  th, td { border: 0.5pt solid #999; padding: 2pt 3pt; vertical-align: top; text-align: left; }
  th { background: #e8e8e8; }
  a { color: inherit; text-decoration: none; }`;

const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>${markdown(fs.readFileSync('DIAGNOSTICO.md', 'utf8'), { headingShift: 0 })}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.emulateMedia({ media: 'print' });
// Ancho imprimible de A4 con 12 mm por lado: 186 mm.
const clipped = await page.evaluate(() => {
  document.body.style.width = '186mm';
  return [...document.querySelectorAll('body *')]
    .filter(node => node.getBoundingClientRect().right > document.body.getBoundingClientRect().right + 0.5)
    .map(node => node.outerHTML.slice(0, 80));
});
fs.mkdirSync(output.replace(/\/[^/]+$/, ''), { recursive: true });
const pdf = await page.pdf({ path: output, format: 'A4', preferCSSPageSize: true, printBackground: true });
await browser.close();
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(JSON.stringify({ output, pages, clipped }, null, 2));
if (pages !== 1 || clipped.length) process.exit(1);
