# Rescate de una suite de calidad: prueba técnica Líder QE

Solución de Libaniel Vargas a la prueba técnica asincrónica del proceso de selección para **Líder de Quality Engineering en Periferia IT Group**. El enunciado original, sin modificaciones, está en [`ENUNCIADO.md`](ENUNCIADO.md).

El evaluador entregó una aplicación pequeña (Express, frontend vanilla y una base JSON) con una suite Playwright rota, un pipeline que nunca fallaba y un archivo para revisión de código. El reto era diagnosticar, estabilizar, automatizar y gobernar esa solución, no construir funcionalidades nuevas.

## Resultado en una mirada

| Reto | Entregable | Resultado verificado |
|---|---|---|
| 1. Diagnóstico | [`DIAGNOSTICO.md`](DIAGNOSTICO.md) | Las 4 pruebas de la suite original fallaron en dos ejecuciones seguidas: la aplicación respondía `Cannot GET /` porque la ruta del proyecto tiene un espacio. Con esa causa corregida pasó 1 de 4; las otras 3 fallaban por la propia suite. 13 hallazgos priorizados. |
| 2. Automatización | [`tests/e2e/`](tests/e2e) | Flujo cliente → operación → interfaz → API, con Page Object, esperas por condición y pruebas independientes. **15 pruebas: 13 conformes y 2 defectos abiertos como fallo esperado.** |
| 3. Datos sintéticos | [`tests/support/data-rules.js`](tests/support/data-rules.js) | Reglas centralizadas, documentos únicos, saldo insuficiente, casos inválidos y limpieza al terminar. |
| 4. Rendimiento | [`performance/critical-endpoint.js`](performance/critical-endpoint.js) | k6 con 50 usuarios durante 5 min: p95 de 18,84 ms (umbral 800 ms) y 0 % de errores en 14 901 solicitudes. |
| 5. Pipeline | [`.github/workflows/quality.yml`](.github/workflows/quality.yml) | Node 20, `npm ci`, secretos parametrizados, artefactos solo en fallo, y bloqueo por pruebas o umbrales. [Ejecución real en verde](https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/actions/runs/40805453568): E2E 15/15 y k6 de 5 min con p95 de 3,27 ms. |
| 6. Revisión de PR | [`REVISION_PR.md`](REVISION_PR.md) | Nueve hallazgos con severidad. Decisión: **solicitar cambios bloqueantes**. |
| Defectos abiertos | [`DEFECTOS.md`](DEFECTOS.md) | DEF-01 (saldo negativo por el cargo del 10 %) y DEF-02 (doble gasto concurrente), con pasos, datos, evidencia y trazabilidad. |

Las decisiones técnicas, las limitaciones, los tiempos y el uso de IA están en [`DECISIONES.md`](DECISIONES.md); el orden de trabajo, en [`CAMBIOS.md`](CAMBIOS.md) y en el historial de Git.

## Defectos que siguen abiertos (a propósito)

La aplicación del evaluador conserva sus reglas de negocio. Dos defectos graves quedan **automatizados como fallo esperado** (`test.fail()`): aparecen en cada reporte, y la prueba se pondrá en rojo el día que se corrijan.

- **DEF-01:** una operación aprobada descuenta el monto más un 10 %, pero la validación solo compara el monto. Un saldo de 1 000 que opera 1 000 queda en −100.
- **DEF-02:** el saldo se valida antes de consultar el servicio de riesgo. Cinco operaciones simultáneas de 90 sobre un saldo de 100 se aprueban todas.

La aplicación **no** se declara apta para producción.

## Ejecutarlo localmente

Requisitos: Node.js 20 o superior y npm. Para el reto 4 se necesita además k6.

```bash
npm ci
npx playwright install chromium
npm start                      # aplicación y página de la entrega en http://127.0.0.1:3000
npm run test:e2e               # suite completa (levanta sus propios servidores aislados)
npm run test:e2e:report        # abre el reporte HTML
```

La página de inicio reúne la aplicación bajo prueba, los seis retos con sus evidencias y un botón **«Ejecutar suite»**. Ese botón lanza Playwright de verdad en el servidor y muestra el avance y un reporte propio por ejecución. En local funciona solo desde `localhost`; en un servidor público opera con límites (ver [`DECISIONES.md`](DECISIONES.md) y [`DESPLIEGUE.md`](DESPLIEGUE.md)).

Prueba de rendimiento, con la aplicación ya levantada:

```bash
BASE_URL=http://127.0.0.1:3000 npm run test:performance          # 50 usuarios, 5 minutos
k6 run -e DURATION=30s performance/critical-endpoint.js         # corrida reducida
```

## Estructura

```
src/                 Aplicación del evaluador (server.js, db.js, public/)
src/qa-runner.js     Ejecutor de la suite para la página de la entrega (aparte del sistema bajo prueba)
src/public/revision.*  Capa de presentación de la entrega (no altera app.js ni styles.css)
tests/e2e/           Especificaciones Playwright
tests/pages/         Page Object
tests/support/       Fábrica y reglas de datos, cliente API, fixtures, ambientes
performance/         Prueba k6
review-target/       Código revisado en el reto 6 (sin modificar)
evidencias/          Logs, reportes y capturas de cada verificación
deploy/              Servicio systemd y bloque de Caddy para el despliegue
```

## Nota sobre valores sensibles en el repositorio

`qa-token-2026-visible` (pipeline original) y `Admin2026!` (`review-target/payment-helper.js`) son **valores ficticios sembrados por el enunciado** como parte de los retos 5 y 6. No son credenciales reales; se conservan porque son el objeto de la evaluación.

---

Libaniel Vargas · Ingeniero de Sistemas · Magíster en Gestión de TI
[GitHub](https://github.com/libanielvargas) · [LinkedIn](https://www.linkedin.com/in/libanielvargas) · [qirava.co](https://qirava.co) · libanielvargas@gmail.com
