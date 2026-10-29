# Registro de decisiones

## Tiempos declarados

| Fase | Inicio | Fin | Nota |
|---|---|---|---|
| Análisis inicial del repositorio (lectura de código, sin ejecutar) | Sesión previa | — | Hora exacta no registrada; **completar por el candidato**. |
| Ejecución (baseline de Git a cierre) | 2026-10-28 16:24 (-05) | 2026-10-28 16:38 (-05) — ~20 min de reloj, de los cuales 5 min fueron la corrida k6 completa | Horas tomadas del reloj local y del historial de commits. |
| Fase 2: presentación, ejecutor público, publicación y preparación del despliegue | 2026-10-28 ~18:40 (-05) | 2026-10-28 (cierre en `CAMBIOS.md`) | Incluye ~1 h perdida por el incidente de disco descrito abajo. Fuera de las 3 h del reto: es material de portafolio y despliegue, no parte del enunciado. |

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
- **Ejecución real en GitHub Actions:** run [40805453568](https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/actions/runs/40805453568) en `success`. E2E: 15 pasadas (13 conformes y 2 defectos abiertos). k6 completo: p95 de 3,27 ms y 0 % de errores en 15 001 solicitudes (`evidencias/publicacion/`).
- **No validado:** el ambiente `staging` y el secreto `RISK_API_TOKEN` configurado. El mock de riesgo no lo exige; el pipeline corre con el valor por defecto.

## Fase 2: presentación, ejecutor público y publicación

### Auditoría de cambios sobre los archivos originales

| Archivo original | Cambio | Clasificación | Justificación y evidencia |
|---|---|---|---|
| `src/server.js` | `fileURLToPath` en la ruta estática | Corrección técnica indispensable | Sin ella, `GET /` respondía 404 y fallaban todas las pruebas de UI (`evidencias/baseline/`). |
| `src/server.js` | Una línea: `registerQualityReview(app)` | Presentación (registro de la capa de revisión) | La lógica vive en `src/qa-runner.js`, aparte del sistema bajo prueba. |
| `src/public/app.js` | Estado real en lugar de `PENDING` fijo | Modificación funcional justificada | El reto 2 exige validar el resultado en la interfaz; documentado en `DIAGNOSTICO.md` y verificado por mutación (`evidencias/e2e/mutacion-pending-detectada.txt`). |
| `src/public/index.html` | Nueva estructura de página; los formularios y los IDs del laboratorio quedan intactos | Presentación | `app.js` sigue funcionando sin cambios: las 15 pruebas pasan. |
| `src/public/styles.css` | Ninguno; se restauró el original | — | La sesión previa lo había mezclado con estilos de presentación; ahora viven en `revision.css`. |
| `src/db.js`, reglas de negocio | Ninguno | — | El cargo del 10 %, DEF-01 y DEF-02 se conservan y se prueban como defectos abiertos. |
| `README.md` | Reescrito para quien llega al repositorio | Documentación | El enunciado original, sin cambios, está en `ENUNCIADO.md`. |

La sesión previa dejó la presentación mezclada con `app.js` y `styles.css`. Se conservó tal cual en el commit `df8edc6` para trazabilidad y luego se reorganizó.

### Ejecutor de la suite desde la página (`src/qa-runner.js`)

- **Modos:** `QA_RUNNER_MODE=off`, `local` (por defecto, solo loopback) o `public` (detrás del reverse proxy).
- **Comando fijo:** Playwright con argumentos constantes. La petición HTTP no aporta parámetros, y el proceso hijo solo hereda `PATH`, `HOME`, `TMPDIR` y la ruta de navegadores, no los secretos de la aplicación.
- **Controles:**
  - Una ejecución a la vez.
  - 1 worker.
  - Máximo 180 s, con apagado en dos fases (`SIGINT` y luego `SIGKILL`).
  - 90 s de espera entre ejecuciones.
  - 4 ejecuciones por hora por IP y 15 por hora en total.
  - Verificación de `Origin` para evitar ejecuciones disparadas desde otro sitio.
  - `trust proxy` solo para el proxy configurado.
- **Reporte por ejecución:** cada corrida tiene un ID; su reporte HTML lo muestra en la cabecera; se conservan las últimas 5.
- **Resumen honesto:** se lee del reporte JSON y separa *conformes* de *defectos conocidos*, porque Playwright cuenta los `test.fail()` como «passed». Los títulos de DEF-01 y DEF-02 lo dicen explícitamente.
- **Evidencia:** `evidencias/e2e/ejecutor-publico-seguridad.txt` contiene 18 verificaciones: sin `Origin` → 403, otro origen → 403, concurrencia → 409, enfriamiento → 429, límite por IP → 429, *path traversal* → 404, tiempo máximo sin procesos huérfanos y modo `off` → 403.
- **Defecto propio detectado y corregido:** la primera versión cortaba con `SIGKILL` directo y dejaba vivos los `webServer` de Playwright, que corren en grupos de procesos propios.
- **La prueba de carga no se puede lanzar desde la página:** corre solo en el pipeline.

### Presentación

- **Separación:** capa propia en `revision.css`, `revision.js` y `laboratorio.js`.
- **Redacción:** primera persona, con cada cifra acompañada de qué mide, dónde se obtuvo y cómo la interpreto. Ninguna medición se atribuye al VPS.
- **Tipografía:** Outfit (la de Periferia) para titulares y la fuente del sistema para el texto, por legibilidad.
- **Favicon:** derivado de la variante transparente; canal alfa verificado sobre pestañas claras y oscuras (`evidencias/visual/favicon-temas.png`).
- **Hero:** carrusel de tres escenas en WebP (49 a 60 KB). Respeta `prefers-reduced-motion` y sin imágenes conserva un fondo oscuro.
- **Pie de página:** fotografía tomada del CV del candidato, con los datos de contacto autorizados; sin dirección ni documento de identidad.
- **Verificación visual:** escritorio, tableta y móvil (`evidencias/visual/`), sin desborde horizontal ni errores de consola.

### Ajustes de presentación del 29-oct-2026: alcance

Antes de tocar la interfaz separé tres grupos, contrastándolos con `ENUNCIADO.md` y el commit base `3e3215b`:

| Grupo | Qué incluye | Qué hice |
|---|---|---|
| A. Presentación autorizada | `index.html` (envoltorio y formularios), `revision.*`, `laboratorio.js` | Implementado. |
| B. Defectos del sistema bajo prueba | DEF-01, DEF-02 y los hallazgos de `DIAGNOSTICO.md` | Documentados en `DEFECTOS.md`; no corregidos. |
| C. Funcionalidades nuevas | Endpoint para listar o buscar clientes, historial persistente propio, cambios de reglas | No implementadas. |

- **Sin cambios en el sistema entregado:** `src/server.js`, `src/db.js`, `src/public/app.js` y `src/public/styles.css` no cambiaron en esta etapa. La capa nueva, `laboratorio.js`, observa lo que escribe `app.js` y consulta la API existente: `GET /api/clients/:id`, `GET /api/operations/:id` y `GET /api/clients/:id/summary`. Escribe con `textContent`, sin `innerHTML`.
- **Selector de clientes:** la API no tiene un endpoint para listar clientes, así que el selector ofrece los creados desde el navegador (guardados en `localStorage`, y validados contra la API al cargar) o los que se agregan por su ID interno. `app.js` sigue completando su campo de ID, que ahora está oculto, pero la operación usa solo el cliente que la persona elige. El formulario ya no precarga el valor 100.
- **Historial:** `GET /api/clients/:id/summary` sí devuelve todas las operaciones (`operations[]` y `operationCount`). El resumen original muestra solo la primera; la capa nueva presenta el historial tal como lo devuelve la API, sin fabricar datos.
- **Valores en pesos colombianos:** solo en la presentación (`Intl.NumberFormat('es-CO')`). La API sigue recibiendo y devolviendo números.
- **Respuesta literal:** la línea que escribe `app.js` («Operación 3: APPROVED», «insufficient balance») sigue visible, con la etiqueta «Respuesta de la aplicación». Las tarjetas la traducen sin ocultarla.

### Error del ejecutor en el puerto 4329 (29-oct-2026)

**Síntoma.** Al presionar el botón aparecía «No fue posible consultar el estado del ejecutor».

**Causa.** El proceso de Node del puerto 4329 se inició el 28-oct a las 17:26, antes del commit que agregó el ejecutor (`d6daeb0`, 21:16). Node conserva en memoria el `server.js` de ese momento, sin las rutas `/revision/*`. En cambio, `express.static` sirve `index.html` y `revision.js` desde el disco en cada petición. La página nueva consultaba un servidor viejo y recibía un 404 en HTML.

**Defecto propio.** `revision.js` trataba cualquier falla (red, 404, respuesta que no es JSON) con el mismo mensaje genérico. No fue un problema de CORS ni de puerto.

**Corrección.**
- La interfaz distingue sin red, servidor sin ejecutor (404), acceso denegado (403) y error del servidor.
- La interfaz reintenta durante una ejecución en curso.
- En modo local, el 403 explica que solo se aceptan solicitudes desde la misma máquina.
- Reinicié el proceso con la misma configuración.

**Verificación.** Ejecución `20261029-182655-eaf0` desde la interfaz: 13 conformes, 2 defectos conocidos, el reporte con el mismo ID y 0 procesos huérfanos. No relajé ningún control del ejecutor.

### Ajustes de cierre (29-oct-2026, tarde)

Los cinco ajustes son del grupo A (presentación). `src/server.js`, `src/db.js`, `src/public/app.js` y el contrato de la API no cambiaron.

- **Consulta entre clientes.**
  - **Problema:** «3. Consultar resultado» mostraba solo al cliente de la última operación, porque `app.js` consulta siempre a ese cliente.
  - **Solución:** agregué un selector propio de consulta que usa únicamente `GET /api/clients/:id/summary`.
  - **Comportamiento:** si la persona no ha elegido un cliente, la consulta sigue al operado, como hacía `app.js`. Si ya eligió uno, lo conserva aunque se opere sobre otro.
  - **«Actualizar»:** se intercepta en fase de captura para que consulte al cliente elegido.
  - **Prueba de regresión:** `tests/e2e/consulta-clientes.spec.js`.
  - **Regresión que detecté y corregí:** en una primera versión, «Actualizar», usado después de una operación rechazada sin cliente elegido, mostraba «Elige un cliente». La prueba de saldo insuficiente lo detectó.
- **Resultados del ejecutor.**
  - **Fuente:** el servidor lee el JSON oficial de Playwright (`resultado.json`) y entrega el estado, la duración, los conteos y la lista de escenarios con resultado, duración, pasos y adjuntos.
  - **Página:** muestra esos datos y enlaza cada escenario al reporte HTML oficial (`#?testId=`). El registro técnico queda contraído bajo «Ver registro técnico».
  - **Lo que no cambió:** no hay UI Mode en producción, ni servidores nuevos, ni videos adicionales. La configuración de capturas, trazas y videos sigue siendo `retain-on-failure`.
- **Pie de página.**
  - **Contenido:** identidad y contactos tomados del perfil canónico del Vault (`PERFIL_PROFESIONAL_CANONICO.md`).
  - **LinkedIn:** el CV V8 en PDF todavía tiene el enlace con guion, que el perfil canónico marca como desactualizado. `linkedin.com/in/libanielvargas/` redirige con 301 a `/in/libanielvargas`. Más allá de eso, LinkedIn responde 999 a los clientes automatizados.
- **Evidencias del punto de partida.**
  - **Problema:** la página citaba `evidencias/baseline/` como texto, y esa ruta respondía `Cannot GET`. El problema era de nuestra presentación, no de la aplicación entregada.
  - **Solución:** cada paso enlaza su evidencia, y un catálogo indica qué demuestra cada archivo y si corresponde al estado inicial o al sistema intervenido.
  - **Cómo se publican:** se sirven desde una lista cerrada en `qa-runner.js` (`/revision/evidencias/...`), sin listado de directorios. `/evidencias/baseline/` redirige al catálogo.
  - **Prueba:** `tests/e2e/presentacion-evidencias.spec.js` comprueba que cada enlace responde con el tipo esperado y que ninguna ruta interna aparece como texto sin enlace.
- **Accesos de Qirava.** El inventario canónico, sin secretos, quedó en el Knowledge Vault (`10-fabrica/gobierno/docs/devops/INVENTARIO_ACCESOS_INFRAESTRUCTURA.md`).

La suite pasó de 15 a 17 pruebas: 15 conformes y 2 defectos conocidos. Repetida cinco veces, dio 85 de 85 (`evidencias/e2e/estabilidad-repeat-each-5-17.txt`). Las cifras anteriores conservan su fecha y su contexto.

### Vistas de los retos 1, 3, 4 y 6 (29-oct-2026)

**Problema.** Varios entregables solo podían consultarse leyendo Markdown o código en GitHub.

**Solución.** Agregué cuatro vistas, generadas por `src/retos.js` en cada solicitud: `/retos/diagnostico`, `/retos/datos-sinteticos`, `/retos/rendimiento` y `/retos/revision-pr`.

**Fuentes canónicas.** Las vistas no tienen cifras copiadas: las leen de sus fuentes.
- `DIAGNOSTICO.md`: los 13 hallazgos. Agregué a su tabla la columna «Evidencia» sin alargar el documento de una página.
- `tests/support/data-rules.js` y `data-factory.js`: las reglas vigentes y un ejemplo generado en cada solicitud.
- Los archivos de prueba: qué funciones de la fábrica usa cada uno y qué escenarios declara.
- Los resúmenes JSON de k6 y la evidencia de la ejecución en GitHub Actions: las métricas.
- `REVISION_PR.md` y `review-target/payment-helper.js`: los 9 hallazgos, la decisión y el código con las líneas marcadas.

**Encabezado y pie compartidos.** Se extraen de `src/public/index.html`, que los marca como bloques compartidos. No hay una segunda copia.

**Arquitectura.** Mismo stack: Express, HTML, CSS y JavaScript, con un intérprete mínimo de Markdown y sin dependencias nuevas. `server.js`, `db.js`, `app.js` y las reglas de negocio no cambiaron.

**Rendimiento.** La vista separa los resultados locales, de CI y de producción. En producción no hay cifras porque no ejecuté la prueba de carga contra el servidor compartido.

**Prueba.** `tests/e2e/presentacion-retos.spec.js` lee las fuentes por su cuenta y compara:
- Hallazgos, severidades y prioridades.
- Las cifras de p95.
- Las reglas de datos.
- Que el encabezado y el pie sean idénticos a los de la portada.
- Que no haya enlaces internos rotos.

Verifiqué que la prueba detecta errores: al alterar a propósito el p95 mostrado, falló.

**Estado de la suite.** Ahora tiene 18 pruebas: 16 conformes y 2 defectos conocidos. Repetida cinco veces, dio 90 de 90 (`evidencias/e2e/estabilidad-repeat-each-5-18.txt`).

### Incidente: Docker llenó el disco de la Mac

Una construcción de imagen Docker (Chromium y caché de BuildKit) agotó el disco local y dejó el motor de Docker en estado de error. Se liberaron solo cachés autorizadas y se descartó Docker como requisito. El despliegue propuesto usa Node.js con systemd y límites de cgroup (`DESPLIEGUE.md`). Ninguna imagen Docker se publicó ni se dejó en el repositorio sin verificar.

### Despliegue

El propietario autorizó usar la clave de despliegue de Qirava. La inspección del servidor real cambió dos decisiones:
- **Memoria:** el droplet tiene 961 MiB, así que el servicio quedó con `MemoryHigh` de 380M, `MemoryMax` de 520M y swap propio.
- **Red:** el host no tiene firewall, así que limité la red del servicio con `IPAddressDeny`/`IPAddressAllow` de systemd.

El filtro de red reveló que la página dependía de Google Fonts, y ahora la fuente se sirve desde la aplicación.

Instalé el commit `e33bc04` y ejecuté la suite en el servidor: 13 conformes y 2 defectos conocidos en 62 s, con `qirava.co` respondiendo 200 durante toda la ejecución. Después actualicé a `f522eb9` y, con el registro DNS creado, ejecuté la suite desde el botón de la página pública (https://prueba-tecnica-qa-lead-periferia-it.qirava.co): 13 conformes y 2 defectos conocidos. La evidencia está en `evidencias/publicacion/despliegue-vps-2026-10-29.md`.

## Pendientes y riesgos

| Pendiente | Riesgo | Acción siguiente |
|---|---|---|
| DEF-02: doble gasto concurrente (saldo −395 reproducido) | Pérdida financiera | Bloqueo por cliente o transacción atómica; retirar `test.fail()` cuando se corrija. |
| DEF-01: saldo negativo por el cargo del 10 % | Saldos negativos | Validar `balance >= amount * 1.1`; retirar `test.fail()`. |
| Saldo inicial negativo o `null`, correo sin formato, XSS por `innerHTML` | Datos corruptos, ejecución de script | Validación en el servidor y `textContent` en el frontend; pruebas negativas. |
| `qa-token-2026-visible` y `Admin2026!` siguen en el historial | Son valores ficticios sembrados por el enunciado (reto 5 y reto 6), no credenciales reales | En un sistema real: rotar y purgar el historial. Aquí se conservan porque son el objeto de la evaluación. |
| Persistencia en JSON | No escala ni soporta varios procesos | Base de datos real para ambientes compartidos. |
| Droplet de 1 GB | Durante una ejecución el portal responde más lento y la suite usa swap | Ampliar a 2 GB si la página tendrá uso frecuente (decisión de costo). |

## Herramientas y asistentes de IA

- **Herramientas:** Node 25.2 local (el CI usa 20), Playwright 1.64.1, k6 2.3.0, actionlint 1.7.12, gitleaks, Git y GitHub CLI.
- **Claude Code (Anthropic):** analizó el repositorio, ejecutó los comandos, escribió el código, las pruebas, el pipeline y los documentos, y recolectó la evidencia, bajo instrucciones y revisión del candidato.
- **ChatGPT (OpenAI):** orquestó el proceso y definió las instrucciones y los criterios. Entre ellos: usar `RISK_MODE` aprobado y rechazado, conservar el cargo del 10 % con el saldo esperado de 890, decidir "solicitar cambios bloqueantes" en el PR, usar k6 con 50 VUs y 5 min, y no usar Cucumber ni Screenplay.
- **Validación:** todo resultado declarado está respaldado por logs en `evidencias/`. El candidato revisó y asume las decisiones.
