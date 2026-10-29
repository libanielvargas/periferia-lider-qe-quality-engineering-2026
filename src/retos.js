// Vistas de presentación de los retos 1, 3, 4 y 6. No forma parte del sistema bajo prueba.
// Cada vista se genera en cada solicitud a partir de las fuentes canónicas del repositorio
// (Markdown, JSON de k6, reglas de datos y archivo revisado): no hay cifras copiadas a mano.
// El encabezado y el pie se toman de src/public/index.html, que es su única fuente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = 'https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026';
const rulesUrl = pathToFileURL(path.join(root, 'tests/support/data-rules.js')).href;
const factoryUrl = pathToFileURL(path.join(root, 'tests/support/data-factory.js')).href;

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const number = (value, digits = 3) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: digits });

export const retos = [
  { num: 1, slug: 'diagnostico', title: 'Diagnóstico del arnés', href: '/retos/diagnostico' },
  { num: 2, slug: 'automatizacion', title: 'Automatización del flujo', href: '/#ejecucion' },
  { num: 3, slug: 'datos-sinteticos', title: 'Datos sintéticos', href: '/retos/datos-sinteticos' },
  { num: 4, slug: 'rendimiento', title: 'Prueba de carga', href: '/retos/rendimiento' },
  { num: 5, slug: 'pipeline', title: 'Pipeline', href: `${repo}/actions` },
  { num: 6, slug: 'revision-pr', title: 'Revisión de código', href: '/retos/revision-pr' }
];

// ---------- Enlaces a fuentes ----------
// Las rutas que aparecen en los documentos se convierten en enlaces: evidencias y documentos
// publicados por la propia página; el resto, al archivo en GitHub.
let published = { evidence: new Set(), documents: new Set() };

function sourceHref(file) {
  const clean = file.replace(/^\.\//, '');
  if (clean.startsWith('evidencias/') && published.evidence.has(clean.slice('evidencias/'.length))) {
    return `/revision/${clean}`;
  }
  if (published.documents.has(clean)) return `/revision/documentos/${clean}`;
  return `${repo}/${clean.endsWith('/') ? 'tree' : 'blob'}/main/${clean.replace(/\/$/, '')}`;
}

function sourceLink(file, label = file) {
  const href = sourceHref(file);
  const external = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${esc(href)}"${external}><code>${esc(label)}</code></a>`;
}

const linkablePath = /^(evidencias|tests|performance|review-target|src|scripts|deploy|\.github)\/[\w./-]*$|^[\w.-]+\.(md|js)$/;

// ---------- Markdown mínimo ----------
// Cubre lo que usan los documentos de la entrega: títulos, párrafos, listas anidadas,
// tablas, bloques de código, código en línea, negrita, cursiva y enlaces.
function inline(text) {
  const codes = [];
  let html = esc(text).replace(/`([^`]+)`/g, (_, code) => {
    const raw = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    codes.push(linkablePath.test(raw) && fs.existsSync(path.join(root, raw.replace(/\/$/, '')))
      ? sourceLink(raw) : `<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

const listItem = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const indentOf = line => line.match(/^\s*/)[0].length;

function parseList(lines, start, indent) {
  const ordered = /\d/.test(listItem.exec(lines[start])[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const match = listItem.exec(lines[i]);
    if (!match || match[1].length !== indent || /\d/.test(match[2]) !== ordered) break;
    const parts = [inline(match[3])];
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        const next = lines.slice(i + 1).find(candidate => candidate.trim());
        if (next !== undefined && indentOf(next) > indent) { i += 1; continue; }
        break;
      }
      if (indentOf(line) <= indent) break;
      const nested = listItem.exec(line);
      if (nested) {
        const sub = parseList(lines, i, nested[1].length);
        parts.push(sub.html);
        i = sub.next;
      } else {
        parts.push(`<p>${inline(line.trim())}</p>`);
        i += 1;
      }
    }
    items.push(`<li>${parts.join('')}</li>`);
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

export function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
}

function table(header, rows) {
  return `<div class="table-scroll"><table class="doc-table"><thead><tr>${header.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead>`
    + `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function markdown(text, { headingShift = 1 } = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const end = lines.indexOf('```', i + 1);
      out.push(`<pre class="doc-code"><code>${esc(lines.slice(i + 1, end).join('\n'))}</code></pre>`);
      i = end + 1;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + headingShift, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith('|') && /^\|[\s|:-]+\|$/.test(lines[i + 1] || '')) {
      const header = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith('|')) rows.push(splitRow(lines[i++]));
      out.push(table(header, rows));
      continue;
    }
    if (listItem.test(line)) {
      const list = parseList(lines, i, indentOf(line));
      out.push(list.html);
      i = list.next;
      continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !listItem.test(lines[i]) && !lines[i].startsWith('|') && !/^(#|```)/.test(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}

// Sección «## Título» de un Markdown, hasta el siguiente título del mismo nivel.
export function section(text, title) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.trim() === title);
  if (start < 0) throw new Error(`No existe la sección «${title}»`);
  const level = title.match(/^#+/)[0];
  const end = lines.findIndex((line, i) => i > start && new RegExp(`^${level}\\s`).test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

// Primera tabla de un Markdown como filas de celdas (sin encabezado).
export function firstTable(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line, i) => line.startsWith('|') && /^\|[\s|:-]+\|$/.test(lines[i + 1] || ''));
  const header = splitRow(lines[start]);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i += 1) rows.push(splitRow(lines[i]));
  return { header, rows };
}

const plain = cell => cell.replace(/\*\*/g, '').replace(/`/g, '').trim();

// ---------- Plantilla compartida ----------
function sharedParts() {
  const index = read('src/public/index.html');
  const block = name => {
    const match = index.match(new RegExp(`<!-- compartido:${name}[^>]*-->([\\s\\S]*?)<!-- /compartido:${name} -->`));
    if (!match) throw new Error(`index.html no tiene el bloque compartido «${name}»`);
    return match[1];
  };
  const head = index.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '');
  // En /retos/* los enlaces internos del encabezado apuntan a las secciones de la portada.
  return { head, header: block('encabezado').replace(/href="#/g, 'href="/#'), footer: block('pie') };
}

function retosNav(current) {
  const items = retos.map(reto => {
    const external = reto.href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    const active = reto.slug === current ? ' aria-current="page"' : '';
    return `<li><a href="${esc(reto.href)}"${external}${active}><span>Reto ${reto.num}</span>${esc(reto.title)}</a></li>`;
  });
  return `<nav class="retos-nav" aria-label="Los seis retos"><p>Los seis retos</p><ol>${items.join('')}</ol></nav>`;
}

function page({ slug, title, description, eyebrow, lead, sources, body }) {
  const { head, header, footer } = sharedParts();
  return `<!doctype html>
<html lang="es">
  <head>${head}
    <title>${esc(title)} · Líder QE · Libaniel Vargas</title>
    <meta name="description" content="${esc(description)}" />
  </head>
  <body class="reto-page">
    <a class="skip-link" href="#contenido">Ir al contenido</a>
${header}
    <main id="contenido" class="reto">
      <p class="breadcrumb"><a href="/#retos">← Volver a los seis retos</a></p>
      <div class="reto-intro">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(title)}</h1>
        <p class="reto-lead">${lead}</p>
        <p class="reto-sources">Fuentes originales: ${sources}</p>
      </div>
      ${body}
      ${retosNav(slug)}
    </main>
${footer}
    <script type="module" src="/retos-estado.js"></script>
  </body>
</html>`;
}

// ---------- Reto 1: diagnóstico ----------
function classify(type) {
  if (/Automatización|CI/.test(type)) return 'Automatización';
  if (/Arquitectura/.test(type)) return 'Arquitectura';
  return 'Aplicación';
}

function statusOf(action) {
  const text = plain(action);
  for (const [pattern, label, tone] of [
    [/^Corregido/, 'Corregido', 'ok'], [/^Abierto/, 'Abierto', 'open'], [/^Documentado/, 'Documentado', 'open'],
    [/^Pendiente/, 'Pendiente', 'pending'], [/^Riesgo aceptado/, 'Riesgo aceptado', 'pending']
  ]) if (pattern.test(text)) return { label, tone };
  return { label: 'Ver acción', tone: 'pending' };
}

function evidenceLinks(cell) {
  const files = [...cell.matchAll(/`([^`]+)`/g)].map(match => match[1]);
  return files.map(file => sourceLink(file, path.basename(file.replace(/\/$/, '')))).join(' ');
}

function counts(list) {
  return list.reduce((acc, key) => ({ ...acc, [key]: (acc[key] || 0) + 1 }), {});
}

function statTiles(entries) {
  return `<dl class="reto-stats">${entries.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}

function diagnostico() {
  const doc = read('DIAGNOSTICO.md');
  const { rows } = firstTable(doc);
  const findings = rows.map(([priority, finding, type, impact, action, evidence]) => ({
    priority: plain(priority), finding, type, impact, action, evidence, area: classify(type), status: statusOf(action)
  }));
  const byPriority = counts(findings.map(item => item.priority));
  const byArea = counts(findings.map(item => item.area));
  const byStatus = counts(findings.map(item => item.status.label));
  const summary = doc.match(/\*\*Resumen ejecutivo\.\*\*\s*(.*)/)[1];
  const lineCount = doc.trimEnd().split('\n').length;

  const cards = findings.map((item, i) => `
        <article class="finding" data-priority="${esc(item.priority)}">
          <div class="finding-head">
            <span class="prio prio-${esc(item.priority.toLowerCase())}">${esc(item.priority)}</span>
            <span class="tag">${esc(item.area)}</span>
            <span class="tag muted">${inline(item.type)}</span>
            <span class="state-pill ${item.status.tone}">${esc(item.status.label)}</span>
            <span class="finding-num">Hallazgo ${i + 1} de ${findings.length}</span>
          </div>
          <h3>${inline(item.finding)}</h3>
          <dl class="finding-fields">
            <div><dt>Impacto</dt><dd>${inline(item.impact)}</dd></div>
            <div><dt>Acción</dt><dd>${inline(item.action)}</dd></div>
            <div><dt>Evidencia</dt><dd>${evidenceLinks(item.evidence) || '—'}</dd></div>
          </dl>
        </article>`).join('');

  const body = `
      <section class="reto-block" aria-labelledby="resumen">
        <h2 id="resumen">Resumen</h2>
        <p>${inline(summary)}</p>
        ${statTiles([
          ['Hallazgos', findings.length],
          ...Object.entries(byPriority).map(([key, value]) => [`Prioridad ${key}`, value]),
          ...Object.entries(byArea).map(([key, value]) => [key, value])
        ])}
        <p class="reto-note">Estado: ${Object.entries(byStatus).map(([key, value]) => `${esc(key)} ${value}`).join(' · ')}. Prioridad P1 bloquea; P4 es un riesgo aceptado para el laboratorio. La clasificación sale de la columna «Tipo» del documento.</p>
      </section>
      <section class="reto-block" aria-labelledby="hallazgos">
        <h2 id="hallazgos">Los ${findings.length} hallazgos, en orden de prioridad</h2>
        <div class="finding-list">${cards}</div>
      </section>
      <section class="reto-block reto-columns" aria-labelledby="dependencias">
        <div>
          <h2 id="dependencias">Dependencias</h2>
          ${markdown(doc.match(/\*\*Dependencias\.\*\*\n([\s\S]*?)\n\n/)[1])}
        </div>
        <div>
          <h2>Orden de corrección aplicado</h2>
          ${markdown(doc.match(/\*\*Orden de corrección aplicado\.\*\*\n([\s\S]*?)\n\n/)[1])}
          <p>${inline(doc.trimEnd().split('\n').at(-1))}</p>
        </div>
      </section>
      <p class="reto-note">El enunciado pide el diagnóstico en una página. El documento original se conserva así: ${sourceLink('DIAGNOSTICO.md')}, ${lineCount} líneas. Esta vista lo presenta sin cambiar su contenido.</p>`;

  return page({
    slug: 'diagnostico',
    title: 'Diagnóstico del arnés',
    description: `Los ${findings.length} hallazgos del diagnóstico con prioridad, impacto, acción y evidencia.`,
    eyebrow: 'Reto 1 · Diagnóstico',
    lead: `Clasifiqué ${findings.length} hallazgos entre defectos de la aplicación, de la automatización y de la arquitectura. Cada uno tiene prioridad, impacto, la acción que tomé y la evidencia que lo respalda.`,
    sources: `${sourceLink('DIAGNOSTICO.md')} · <a href="${repo}/blob/main/DIAGNOSTICO.md" target="_blank" rel="noopener">DIAGNOSTICO.md en GitHub</a>`,
    body
  });
}

// ---------- Reto 3: datos sintéticos ----------
function specUsage() {
  const dir = 'tests/e2e';
  return fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.spec.js')).sort().map(file => {
    const source = read(`${dir}/${file}`);
    const imports = source.match(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/support\/data-factory\.js'/);
    const used = imports ? imports[1].split(',').map(name => name.trim()).filter(Boolean) : [];
    const titles = [...source.matchAll(/\btest\(\s*(['`])((?:(?!\1).)+)\1/g)].map(match => match[2].replace(/\$\{[^}]+\}/g, '…'));
    return { file: `${dir}/${file}`, used, titles };
  });
}

async function datosSinteticos() {
  const { dataRules } = await import(rulesUrl);
  const { validClient } = await import(factoryUrl);
  const example = validClient();
  const decisions = read('DECISIONES.md');
  const rules = dataRules;
  const client = rules.client;
  const randomDigits = client.documentLength - client.documentPrefix.length;
  const usage = specUsage();

  const ruleRows = [
    ['Documento', `Prefijo «${client.documentPrefix}» y ${randomDigits} dígitos aleatorios: ${client.documentLength} dígitos en total. La API acepta de 8 a 10.`],
    ['Correo', `Derivado del documento, en el dominio reservado «${client.emailDomain}», que nunca entrega correo real.`],
    ['Nombre', `Combinación de ${client.firstNames.length} nombres y ${client.lastNames.length} apellidos de catálogo, más los 4 últimos dígitos del documento.`],
    ['Saldo inicial', `${number(client.defaultBalance)} por defecto.`],
    ['Operación', `Valor de ${number(rules.operation.defaultAmount)} por defecto. Cargo observado: ${number(rules.operation.serviceChargeRate * 100)} % sobre el valor aprobado.`],
    ['Saldo insuficiente', `Saldo de ${number(rules.insufficientBalance.balance)} frente a una operación de ${number(rules.insufficientBalance.amount)}.`]
  ];
  const invalidClients = rules.invalidClients.map(item => [item.case, Object.entries(item.override).map(([key, value]) => `${key} = «${value}»`).join(', '), String(item.status), item.error]);
  const invalidAmounts = rules.invalidAmounts.map(item => [item.case, `amount = «${item.amount}»`, String(item.status), item.error]);
  const rulesTable = (header, rows) => `<div class="table-scroll"><table class="doc-table${header.length > 2 ? ' wide-table' : ''}"><thead><tr>${header.map(cell => `<th scope="col">${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  const usageRows = usage.map(spec => `<tr><th scope="row">${sourceLink(spec.file, path.basename(spec.file))}</th><td>${spec.used.length ? spec.used.map(name => `<code>${esc(name)}</code>`).join(' ') : 'No usa la fábrica: comprueba la presentación'}</td><td><ul class="plain-list">${spec.titles.map(title => `<li>${esc(title)}</li>`).join('')}</ul></td></tr>`).join('');

  const body = `
      <section class="reto-block" aria-labelledby="reglas">
        <h2 id="reglas">Qué datos se generan</h2>
        <p>Estas son las reglas vigentes, leídas en este momento de ${sourceLink('tests/support/data-rules.js')}. Cambiar una regla allí cambia los datos de todas las pruebas sin tocar los escenarios.</p>
        ${rulesTable(['Dato', 'Regla'], ruleRows)}
        <div class="example-card">
          <p class="card-title">Ejemplo generado por la fábrica en esta solicitud</p>
          <dl class="card-fields">
            <div><dt>Nombre</dt><dd>${esc(example.name)}</dd></div>
            <div><dt>Documento</dt><dd class="mono">${esc(example.document)}</dd></div>
            <div><dt>Correo</dt><dd class="mono">${esc(example.email)}</dd></div>
            <div><dt>Saldo</dt><dd>${esc(number(example.balance))}</dd></div>
          </dl>
          <p class="reto-note">Recarga la página y verás otro cliente: es la misma función que usan las pruebas, ${sourceLink('tests/support/data-factory.js', 'validClient()')}. Este cliente no se guarda en ninguna base.</p>
        </div>
      </section>
      <section class="reto-block" aria-labelledby="invalidos">
        <h2 id="invalidos">Casos inválidos para las pruebas negativas</h2>
        <p>Cada caso declara el dato alterado, el código HTTP y el mensaje que debe devolver la API. Son ${rules.invalidClients.length} casos de cliente y ${rules.invalidAmounts.length} de monto.</p>
        ${rulesTable(['Caso', 'Dato enviado', 'HTTP esperado', 'Mensaje esperado'], [...invalidClients, ...invalidAmounts])}
      </section>
      <section class="reto-block" aria-labelledby="escenarios">
        <h2 id="escenarios">Qué escenarios los usan</h2>
        <p>Tabla obtenida de los archivos de prueba: qué funciones de la fábrica importa cada uno y qué escenarios declara. Los títulos con «…» se repiten una vez por caso del catálogo.</p>
        <div class="table-scroll"><table class="doc-table wide-table"><thead><tr><th scope="col">Archivo</th><th scope="col">Funciones de la fábrica</th><th scope="col">Escenarios</th></tr></thead><tbody>${usageRows}</tbody></table></div>
      </section>
      <section class="reto-block" aria-labelledby="estrategia">
        <h2 id="estrategia">Independencia, limpieza y límites</h2>
        <p>Texto de ${sourceLink('DECISIONES.md')}, sección «Datos sintéticos (Reto 3)».</p>
        <div class="doc-prose">${markdown(section(decisions, '## Datos sintéticos (Reto 3)'))}</div>
        <p class="reto-note">Aislamiento por ejecución: ${sourceLink('tests/support/environments.js')} levanta un servidor y una base por proyecto, y ${sourceLink('tests/support/global-teardown.js')} borra los datos al terminar.</p>
      </section>`;

  return page({
    slug: 'datos-sinteticos',
    title: 'Datos sintéticos',
    description: 'Reglas de generación, casos inválidos, escenarios que los usan, independencia y limpieza de los datos de prueba.',
    eyebrow: 'Reto 3 · Datos sintéticos',
    lead: 'Cada prueba crea sus propios datos con reglas centralizadas. Ninguna depende de otra ni de datos previos en la base, y todo se borra al terminar la ejecución.',
    sources: `${sourceLink('tests/support/data-rules.js')} · ${sourceLink('tests/support/data-factory.js')} · ${sourceLink('DECISIONES.md')}`,
    body
  });
}

// ---------- Reto 4: rendimiento ----------
function k6Run(file) {
  const { metrics } = JSON.parse(read(file));
  const duration = metrics.http_req_duration;
  const failed = metrics.http_req_failed;
  const thresholds = [
    ...Object.entries(duration.thresholds || {}).map(([rule, crossed]) => [`http_req_duration ${rule}`, crossed]),
    ...Object.entries(failed.thresholds || {}).map(([rule, crossed]) => [`http_req_failed ${rule}`, crossed]),
    ...Object.entries(metrics.checks?.thresholds || {}).map(([rule, crossed]) => [`checks ${rule}`, crossed])
  ];
  return {
    vus: metrics.vus_max?.max ?? metrics.vus?.max,
    seconds: Math.round(metrics.http_reqs.count / metrics.http_reqs.rate),
    requests: metrics.http_reqs.count,
    rate: metrics.http_reqs.rate,
    p50: duration.med, p90: duration['p(90)'], p95: duration['p(95)'], max: duration.max, min: duration.min,
    errors: failed.passes, errorRate: failed.value,
    checks: metrics.checks ? `${number(metrics.checks.passes, 0)} de ${number(metrics.checks.passes + metrics.checks.fails, 0)}` : '—',
    // En el resumen de k6, true significa que el umbral se cruzó (falló).
    thresholds
  };
}

function ciRun() {
  const doc = read('evidencias/publicacion/github-actions-run-40805453568.md');
  const k6 = doc.slice(doc.indexOf('## Job «Rendimiento (k6)»'));
  const { rows } = firstTable(k6);
  return {
    heading: k6.split('\n')[0].replace(/^##\s*/, ''),
    rows: rows.map(([rule, result]) => [plain(rule), result]),
    p95: Number(plain(rows.find(([rule]) => rule.includes('p(95)'))[1]).match(/([\d,]+) ms/)[1].replace(',', '.'))
  };
}

function barChart({ id, caption, bars, unit }) {
  const width = 640;
  const label = 150;
  const valueSpace = 90;
  const rowHeight = 34;
  const max = Math.max(...bars.map(bar => bar.value));
  const scale = (width - label - valueSpace) / max;
  const rows = bars.map((bar, i) => {
    const y = i * rowHeight + 6;
    const w = Math.max(bar.value * scale, 2);
    return `<g><title>${esc(bar.label)}: ${esc(number(bar.value))} ${unit}</title>`
      + `<text class="chart-label" x="${label - 10}" y="${y + 15}" text-anchor="end">${esc(bar.label)}</text>`
      + `<rect class="chart-bar" x="${label}" y="${y + 3}" width="${w.toFixed(1)}" height="18" rx="4" />`
      + `<text class="chart-value" x="${label + w + 8}" y="${y + 16}">${esc(number(bar.value))} ${unit}</text></g>`;
  }).join('');
  const height = bars.length * rowHeight + 10;
  return `<figure class="chart" aria-labelledby="${id}"><div class="chart-scroll"><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}">`
    + `<line class="chart-axis" x1="${label}" x2="${label}" y1="0" y2="${height}" />${rows}</svg></div>`
    + `<figcaption id="${id}">${caption}</figcaption></figure>`;
}

function rendimiento() {
  const decisions = read('DECISIONES.md');
  const script = read('performance/critical-endpoint.js');
  const threshold = Number(script.match(/P95_MS \|\| (\d+)/)[1]);
  const runs = [
    { label: 'Local · completa', where: 'Local (mi equipo)', file: 'evidencias/performance/summary-completa-5m.json', log: 'evidencias/performance/k6-completa-50vus-5m.txt' },
    { label: 'Local · reducida', where: 'Local (mi equipo)', file: 'evidencias/performance/summary-reducida-30s.json', log: 'evidencias/performance/k6-reducida-50vus-30s.txt' },
    { label: 'Local · pasos de CI', where: 'Local, con los pasos del pipeline', file: 'evidencias/performance/summary-simulacion-ci-30s.json', log: 'evidencias/pipeline/simulacion-local-pasos-ci.txt' }
  ].map(run => ({ ...run, ...k6Run(run.file) }));
  const ci = ciRun();
  const full = runs[0];
  const ms = value => `${number(value)} ms`;

  const runRows = runs.map(run => `<tr>
          <th scope="row">${esc(run.label)}<span>${esc(run.where)}</span></th>
          <td class="num">${run.vus} VUs · ${run.seconds} s</td><td class="num">${number(run.requests, 0)}</td>
          <td class="num">${ms(run.p50)}</td><td class="num">${ms(run.p90)}</td><td class="num"><strong>${ms(run.p95)}</strong></td><td class="num">${ms(run.max)}</td>
          <td class="num">${number(run.errorRate * 100, 2)} % (${number(run.errors, 0)})</td><td class="num">${esc(run.checks)}</td>
          <td>${run.thresholds.every(([, crossed]) => !crossed) ? '<span class="state-pill ok">Cumple los 3</span>' : '<span class="state-pill open">Incumple</span>'}</td>
          <td>${sourceLink(run.file, 'resumen')} · ${sourceLink(run.log, 'salida')}</td>
        </tr>`).join('');

  const body = `
      <section class="reto-block" aria-labelledby="resultado">
        <h2 id="resultado">Resultado principal</h2>
        ${statTiles([
          ['p95 local, 5 min', ms(full.p95)],
          ['p95 en GitHub Actions, 5 min', ms(ci.p95)],
          ['Umbral de p95', `${number(threshold)} ms`],
          ['Errores, local 5 min', `${number(full.errorRate * 100, 2)} %`],
          ['Solicitudes por segundo', number(full.rate, 1)]
        ])}
        <p>El endpoint medido es <code>GET /api/clients/:id/summary</code>, con ${full.vus} usuarios virtuales en ciclo y una pausa de un segundo entre consultas. Con el umbral de ${number(threshold)} ms, el p95 local queda ${number(threshold / full.p95, 0)} veces por debajo del límite.</p>
      </section>
      <section class="reto-block" aria-labelledby="distribucion">
        <h2 id="distribucion">Distribución del tiempo de respuesta</h2>
        ${barChart({
          id: 'grafica-distribucion',
          unit: 'ms',
          caption: `Corrida local completa: ${number(full.requests, 0)} solicitudes en ${full.seconds} s. La mayoría responde en pocos milisegundos; el máximo, ${ms(full.max)}, es un caso aislado. El umbral de ${number(threshold)} ms no se dibuja porque quedaría fuera de escala.`,
          bars: [['Mínimo', full.min], ['Mediana (p50)', full.p50], ['p90', full.p90], ['p95', full.p95], ['Máximo', full.max]].map(([label, value]) => ({ label, value }))
        })}
        ${barChart({
          id: 'grafica-p95',
          unit: 'ms',
          caption: 'p95 de cada ejecución con evidencia. Los valores no son comparables entre sí como capacidad: cambian la máquina, la duración y el ruido del entorno.',
          bars: [...runs.map(run => ({ label: run.label, value: run.p95 })), { label: 'GitHub Actions', value: ci.p95 }]
        })}
      </section>
      <section class="reto-block" aria-labelledby="ejecuciones">
        <h2 id="ejecuciones">Ejecuciones, por entorno</h2>
        <h3>Local</h3>
        <div class="table-scroll"><table class="doc-table perf-table"><thead><tr><th scope="col">Ejecución</th><th scope="col">Carga</th><th scope="col">Solicitudes</th><th scope="col">p50</th><th scope="col">p90</th><th scope="col">p95</th><th scope="col">Máximo</th><th scope="col">Errores</th><th scope="col">Checks</th><th scope="col">Umbrales</th><th scope="col">Evidencia</th></tr></thead><tbody>${runRows}</tbody></table></div>
        <h3>CI: GitHub Actions</h3>
        <p>${inline(ci.heading)}. La evidencia publicada registra los tres umbrales: ${sourceLink('evidencias/publicacion/github-actions-run-40805453568.md', 'github-actions-run-40805453568.md')} y <a href="${repo}/actions/runs/40805453568" target="_blank" rel="noopener">la ejecución 40805453568</a>.</p>
        <div class="table-scroll"><table class="doc-table"><thead><tr><th scope="col">Umbral</th><th scope="col">Resultado</th></tr></thead><tbody>${ci.rows.map(([rule, result]) => `<tr><th scope="row"><code>${esc(rule)}</code></th><td>${inline(result)}</td></tr>`).join('')}</tbody></table></div>
        <h3>Producción: el servidor de esta página</h3>
        <p>No ejecuté la prueba de carga contra el servidor publicado, y la página no permite lanzarla. Es un servidor compartido de 1 GB que aloja otros servicios, así que no hay cifras de producción. La decisión está en ${sourceLink('DESPLIEGUE.md')}.</p>
      </section>
      <section class="reto-block" aria-labelledby="umbrales">
        <h2 id="umbrales">Umbrales, cuándo bloquea el pipeline e interpretación</h2>
        <p>Texto de ${sourceLink('DECISIONES.md')}, sección «Rendimiento (Reto 4)». Los umbrales están en ${sourceLink('performance/critical-endpoint.js')}.</p>
        <div class="doc-prose">${markdown(section(decisions, '## Rendimiento (Reto 4)'))}</div>
      </section>`;

  return page({
    slug: 'rendimiento',
    title: 'Prueba de carga con k6',
    description: 'Resultados reales de k6 con métricas, umbrales e interpretación, separados por entorno.',
    eyebrow: 'Reto 4 · Rendimiento',
    lead: 'Medí el resumen del cliente con k6 y umbrales automáticos. Las cifras se leen de los archivos de evidencia y se separan por entorno: local, CI y producción.',
    sources: `${sourceLink('performance/critical-endpoint.js')} · ${sourceLink('evidencias/performance/', 'evidencias/performance')} · ${sourceLink('DECISIONES.md')}`,
    body
  });
}

// ---------- Reto 6: revisión del PR ----------
function lineRefs(location) {
  const refs = [];
  for (const match of plain(location).matchAll(/L(\d+)(?:-L?(\d+))?/g)) {
    refs.push([Number(match[1]), Number(match[2] || match[1])]);
  }
  return refs;
}

function revisionPr() {
  const doc = read('REVISION_PR.md');
  const target = doc.match(/\*\*Archivo revisado:\*\*\s*`([^`]+)`/)[1];
  const decision = plain(doc.match(/\*\*Decisión:\*\*\s*(.*)/)[1]).replace(/^[^\p{L}]+/u, '').replace(/\s*\(.*\)\.?$/, '');
  const { rows } = firstTable(section(doc, '## Hallazgos'));
  const code = read(target).replace(/\n$/, '').split('\n');
  const githubFile = `${repo}/blob/main/${target}`;
  const findings = rows.map(([num, location, severity, finding, risk, recommendation]) => ({
    num: plain(num), location, severity: plain(severity), finding, risk, recommendation, refs: lineRefs(location)
  }));
  const bySeverity = counts(findings.map(item => item.severity));
  const flagged = new Map();
  for (const item of findings) {
    for (const [from, to] of item.refs) for (let line = from; line <= to; line += 1) {
      flagged.set(line, [...(flagged.get(line) || []), item.num]);
    }
  }
  const severityClass = { 'Crítica': 'critical', 'Alta': 'high', 'Media': 'medium', 'Baja': 'low' };

  const cards = findings.map(item => {
    const links = item.refs.map(([from, to]) => {
      const anchor = from === to ? `L${from}` : `L${from}-L${to}`;
      return `<a href="#codigo-L${from}">${anchor}</a> (<a href="${githubFile}#${anchor}" target="_blank" rel="noopener">GitHub</a>)`;
    }).join(' · ');
    return `
        <article class="finding" id="hallazgo-${esc(item.num)}">
          <div class="finding-head">
            <span class="finding-num">#${esc(item.num)}</span>
            <span class="sev sev-${severityClass[item.severity] || 'low'}">${esc(item.severity)}</span>
            <span class="tag muted">${inline(item.location)}</span>
          </div>
          <h3>${inline(item.finding)}</h3>
          <dl class="finding-fields">
            <div><dt>Riesgo e impacto</dt><dd>${inline(item.risk)}</dd></div>
            <div><dt>Recomendación</dt><dd>${inline(item.recommendation)}</dd></div>
            <div><dt>Líneas</dt><dd>${links || 'Todo el archivo'}</dd></div>
          </dl>
        </article>`;
  }).join('');

  const codeRows = code.map((line, i) => {
    const n = i + 1;
    const marks = flagged.get(n);
    return `<tr id="codigo-L${n}"${marks ? ' class="flagged"' : ''}><td class="ln"><a href="${githubFile}#L${n}" target="_blank" rel="noopener">${n}</a></td><td class="src"><code>${esc(line) || ' '}</code></td><td class="refs">${marks ? marks.map(num => `<a href="#hallazgo-${num}">#${num}</a>`).join(' ') : ''}</td></tr>`;
  }).join('');

  const body = `
      <section class="reto-block" aria-labelledby="decision">
        <h2 id="decision">Decisión</h2>
        <div class="decision-banner"><strong>${esc(decision)}</strong><span>Archivo revisado: ${sourceLink(target)}</span></div>
        ${statTiles([['Hallazgos', findings.length], ...Object.entries(bySeverity).map(([key, value]) => [key, value])])}
      </section>
      <section class="reto-block" aria-labelledby="hallazgos">
        <h2 id="hallazgos">Los ${findings.length} hallazgos</h2>
        <div class="finding-list">${cards}</div>
      </section>
      <section class="reto-block" aria-labelledby="codigo">
        <h2 id="codigo">Archivo revisado, con los hallazgos marcados</h2>
        <p>Contenido actual de ${sourceLink(target)}, sin cambios: es el material del enunciado. Cada número de línea abre esa línea en GitHub. Los valores sensibles son ficticios y forman parte del ejercicio.</p>
        <div class="code-view"><table><tbody>${codeRows}</tbody></table></div>
      </section>
      <section class="reto-block" aria-labelledby="propuesta">
        <h2 id="propuesta">Forma esperada y decisión final</h2>
        <div class="doc-prose">${markdown(section(doc, '## Propuesta de forma esperada'))}${markdown(section(doc, '## Decisión final'))}</div>
      </section>`;

  return page({
    slug: 'revision-pr',
    title: 'Revisión del pull request',
    description: `Los ${findings.length} hallazgos de la revisión de código con severidad, ubicación, riesgo, recomendación y decisión.`,
    eyebrow: 'Reto 6 · Revisión de código',
    lead: `Revisé el helper de pagos propuesto en el PR. Registré ${findings.length} hallazgos con severidad, ubicación en el código, riesgo y una recomendación concreta para cada uno.`,
    sources: `${sourceLink('REVISION_PR.md')} · <a href="${githubFile}" target="_blank" rel="noopener">${esc(target)} en GitHub</a>`,
    body
  });
}

const views = { diagnostico, 'datos-sinteticos': datosSinteticos, rendimiento, 'revision-pr': revisionPr };

export function registerRetos(app, { evidence, documents }) {
  published = { evidence, documents };
  app.get('/retos', (req, res) => res.redirect(302, '/#retos'));
  app.get('/retos/:slug', async (req, res, next) => {
    const view = views[req.params.slug];
    if (!view) return next();
    try {
      return res.type('html').send(await view());
    } catch (error) {
      console.error(`No fue posible generar /retos/${req.params.slug}:`, error);
      return res.status(500).type('text/plain; charset=utf-8').send('No fue posible generar esta vista. Las fuentes originales están en el repositorio.');
    }
  });
}
