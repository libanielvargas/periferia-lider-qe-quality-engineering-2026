# Registro de decisiones

## Tiempos declarados

| Fase | Inicio | Fin | Nota |
|---|---|---|---|
| Análisis inicial del repositorio (lectura de código, sin ejecutar) | Sesión previa | — | Hora exacta no registrada; **completar por el candidato**. |
| Ejecución (baseline de Git a cierre) | 2026-10-28 16:24 (-05) | 2026-10-28 16:38 (-05) — ~20 min de reloj, de los cuales 5 min fueron la corrida k6 completa | Horas tomadas del reloj local y del historial de commits. |

## Decisiones técnicas

1. **Primero desbloquear, después reescribir.** La suite original fallaba porque el frontend no se servía en rutas con espacios. Se corrigió solo eso (`fileURLToPath`) y se volvió a ejecutar la suite original para ver la segunda capa de fallas antes de reemplazarla (`evidencias/baseline/`).
2. **Correcciones mínimas a la aplicación.** Solo las que bloquean el flujo:
   - La ruta estática.
   - El `PENDING` fijo del resumen.

   No se tocaron reglas de negocio. El **cargo del 10 %** se conserva como comportamiento observado: 1000 − (100 + 10) = **890**, valor que verifica la prueba principal.
3. **Defectos conocidos visibles, no ocultos.** El saldo negativo (DEF-01) se automatizó con `test.fail()`: aparece como "expected to fail" y se pone en rojo cuando se corrija. El doble gasto concurrente y las validaciones faltantes quedan documentados en `DIAGNOSTICO.md`, sin cambiar el código.
4. **Determinismo del servicio de riesgo.** Hay dos proyectos de Playwright (`riesgo-aprobado` y `riesgo-rechazado`), cada uno con su propio servidor (`RISK_MODE=approved` y `rejected`), puerto (4310 y 4311) y base JSON en `test-data/`. Nunca se reutiliza un servidor existente; durante el diagnóstico se reprodujo cómo esa opción conectaba la suite a un proceso viejo.
5. **Diseño de la suite.** Se usa un Page Object sencillo (`tests/pages/operations-page.js`), un cliente API, fixtures y pasos con `test.step`. Las esperas son por condición, incluida la del refresco aleatorio del resumen. No hay reintentos (`retries: 0`) para que la inestabilidad se vea. No se agregaron Cucumber ni Screenplay.
6. **Evidencias.**
   - Cada prueba de negocio adjunta una captura y el JSON de confirmación por API al reporte HTML.
   - Trazas, videos y capturas automáticas solo en fallo (`retain-on-failure` y `only-on-failure`).
   - JUnit en `reports/junit.xml`.

## Datos sintéticos (Reto 3)

- **Reglas centralizadas** en `tests/support/data-rules.js`: prefijo y longitud del documento, dominio de correo, saldos, tasa de cargo, caso de saldo insuficiente y catálogo de casos inválidos con su estado y mensaje esperados. Los specs consumen la fábrica `tests/support/data-factory.js`; cambiar una regla no requiere tocar las pruebas.
- **Documentos únicos:** prefijo `7` más 9 dígitos con `crypto.randomInt`, con un registro en memoria por worker para evitar repetidos.
- **Clientes:**
  - Válidos: nombre y correo derivados del documento, en el dominio reservado `example.test`.
  - Con saldo insuficiente: saldo 50 frente a un monto de 100.
  - Inválidos: 5 casos de cliente y 3 de monto.
- **Limpieza:** cada ejecución arranca con la base de prueba reseteada y el `globalTeardown` borra `test-data/`. `KEEP_TEST_DATA=1` conserva los datos para depurar.
- **Limitaciones:**
  - No hay limpieza por prueba porque la API no expone `DELETE`; no se agregó para no ampliar el alcance. La independencia se logra con datos únicos y la base aislada.
  - La unicidad entre workers es probabilística (alrededor de 10⁹ combinaciones). Una colisión daría 409 visible, no un falso verde.
  - Los datos no cubren límites de longitud ni caracteres especiales, y los nombres usan un catálogo corto.

## Rendimiento (Reto 4)

- **Script:** `performance/critical-endpoint.js` con k6, escenario `constant-vus` de 50 VUs durante 5 min y 1 s de *think time*.
- **Umbrales:** `p(95)<800`, `http_req_failed<1%` y `checks>99%`.
- **Precondición:** se valida en `setup()`.
- **Parámetros:** `BASE_URL`, `VUS`, `DURATION`, `P95_MS`, `THINK_TIME` y `CLIENT_ID`.
- **Corrida local completa (50 VUs, 5 min):**
  - p95 = **18.84 ms**.
  - Errores = **0 %** de 14 901 peticiones.
  - Checks = 100 %.
  - Código de salida 0 (`evidencias/performance/k6-completa-50vus-5m.txt`).
- **Corrida reducida:** 30 s con p95 de 9.46 ms.
- **Cuándo bloquea el pipeline:** siempre que k6 incumple un umbral. k6 sale con código 99 (verificado forzando `P95_MS=1`) y el job falla.
  - En los PR corre una versión corta bloqueante (50 VUs, 1 min) para no frenar el ciclo.
  - En `main` y en la ejecución manual corre la versión completa (5 min).
  - El job de rendimiento depende del E2E: no se mide un build funcionalmente roto.
- **Limitación:** el resultado local es optimista. Es la misma máquina, sin red, con una base de un solo cliente y sin escrituras concurrentes. No representa producción.

## Pipeline (Reto 5)

- **Configuración del workflow:**
  - Node 20, `npm ci` con lockfile y caché de npm.
  - Chromium con dependencias del sistema.
  - Arranque controlado: en E2E por `webServer` de Playwright con espera a `/health`; en rendimiento con `curl --retry` antes de k6.
- **Reportes y artefactos:**
  - El reporte HTML y JUnit se publican siempre, salvo si se cancela la ejecución.
  - `test-results/` (trazas, videos y capturas) solo se sube en fallo.
  - Los resultados de k6 se publican siempre.
- **Parámetros:** el token sale de `secrets.RISK_API_TOKEN`; el ambiente de GitHub (`qa` o `staging`) y las variables `vars.*` se eligen por `workflow_dispatch`.
- **Fallas visibles:** se quitaron `continue-on-error` y `|| true`.
- **Validación sin GitHub Actions** (evidencia en `simulacion-local-pasos-ci.txt`: E2E 14/14, k6 reducido con salida 0):
  1. `actionlint` 1.7.12 sin errores (`evidencias/pipeline/`).
  2. Simulación local de los pasos con `CI=true`: `npm ci`, `npm run test:e2e`, arranque de la app con `curl --retry` y `npm run test:performance` (`evidencias/pipeline/`).
  3. Verificación de que la suite falla ante una regresión inyectada (`evidencias/e2e/mutacion-pending-detectada.txt`) y de que k6 devuelve 99 al incumplir un umbral.
- **No validado:** la ejecución real en GitHub, la creación de los ambientes `qa` y `staging`, el secreto configurado y la acción `grafana/setup-k6-action`.

## Pendientes y riesgos

| Pendiente | Riesgo | Acción siguiente |
|---|---|---|
| Doble gasto concurrente (saldo −395 reproducido) | Pérdida financiera | Bloqueo por cliente o transacción atómica; agregar una prueba concurrente. |
| DEF-01: saldo negativo por el cargo del 10 % | Saldos negativos | Validar `balance >= amount * 1.1`; retirar `test.fail()`. |
| Saldo inicial negativo o `null`, correo sin formato, XSS por `innerHTML` | Datos corruptos, ejecución de script | Validación en el servidor y `textContent` en el frontend; pruebas negativas. |
| Rotar `qa-token-2026-visible` y `Admin2026!` | Credenciales expuestas en el historial | Rotar y purgar el historial si el repositorio es compartido. |
| Persistencia en JSON | No escala ni soporta varios procesos | Base de datos real para ambientes compartidos. |
| Pipeline no ejecutado en GitHub | Diferencias de entorno | Primer run en una rama y ajustar si algo difiere. |

## Herramientas y asistentes de IA

- **Herramientas:** Node 25.2 local (el CI usa 20), Playwright 1.64.1, k6 2.3.0, actionlint 1.7.12 y Git.
- **Claude Code (Anthropic):** analizó el repositorio, ejecutó los comandos, escribió el código, las pruebas, el pipeline y los documentos, y recolectó la evidencia, bajo instrucciones y revisión del candidato.
- **ChatGPT (OpenAI):** orquestó el proceso y definió las instrucciones y los criterios. Entre ellos: usar `RISK_MODE` aprobado y rechazado, conservar el cargo del 10 % con el saldo esperado de 890, decidir "solicitar cambios bloqueantes" en el PR, usar k6 con 50 VUs y 5 min, y no usar Cucumber ni Screenplay.
- **Validación:** todo resultado declarado está respaldado por logs en `evidencias/`. El candidato revisó y asume las decisiones.
