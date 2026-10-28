# Diagnóstico del arnés

**Resumen ejecutivo.** La suite original falla 4 de 4 pruebas (`evidencias/baseline/`), pero la causa raíz no está en las pruebas: el servidor resuelve la carpeta estática con `URL.pathname`, y como la ruta del proyecto tiene un espacio (`Candidato (1)`), la aplicación responde `Cannot GET /`. Corregido eso, aparecen la segunda capa de fallas y un pipeline que **nunca puede fallar**. La suite no era confiable por diseño: pruebas acopladas por orden e ID, datos quemados, un servicio de riesgo aleatorio sin control, esperas fijas y escritura sobre la base de desarrollo. Hay además defectos de negocio graves en saldo y concurrencia.

| Prior. | Hallazgo | Tipo | Impacto | Acción |
|---|---|---|---|---|
| P1 | `express.static(new URL(...).pathname)` falla con rutas que tienen espacios: `GET /` responde 404. | Funcional (entorno) | Bloquea el 100 % de la interfaz y de las pruebas de UI. | **Corregido** con `fileURLToPath`. |
| P1 | El pipeline no falla nunca: `continue-on-error`, script inexistente `e2e:test`, Node 16 (el proyecto exige 20 o más), `npm start &` sin espera, reporte en `reports/` solo si hay éxito, k6 no instalado, ruta `load.js` inexistente y `\|\| true`. | Automatización / CI | Falsos verdes, sin reporte ni evidencia del fallo. | **Corregido** (`quality.yml`). |
| P1 | Token `qa-token-2026-visible` escrito en el YAML. | Seguridad | Secreto expuesto en el repositorio. | **Corregido**: `secrets.RISK_API_TOKEN`. Hay que rotarlo. |
| P1 | **Doble gasto concurrente**: el saldo se valida antes del `await` al servicio de riesgo. Con saldo 100, cinco operaciones de 90 en paralelo se aprueban todas y el saldo queda en −395. | Funcional | Pérdida financiera. | **Pendiente**: requiere bloqueo o transacción. Documentado. |
| P2 | La validación compara solo el monto, pero se descuenta monto + 10 %: con saldo 1000 y operación de 1000 el saldo queda en −100. | Funcional | Saldos negativos. | **Documentado** como DEF-01 con `test.fail()`. El cargo del 10 % se conserva como comportamiento observado. |
| P2 | El resumen muestra `PENDING` fijo en lugar del estado real. | Funcional (UI) | El usuario ve un estado falso. | **Corregido**. |
| P2 | Pruebas dependientes del orden (cliente 2, operación 1), documento quemado (409 desde la segunda corrida) y saldo esperado de $900 sin el cargo. | Automatización | Fallas según el orden de ejecución o los workers. | **Corregido**: pruebas independientes con datos sintéticos. |
| P2 | `RISK_MODE=random` rechaza el 15 %; las pruebas no lo controlan. | Automatización | Inestabilidad estructural. | **Corregido**: proyectos con `approved` y `rejected`. |
| P3 | `waitForTimeout` fijos frente a un refresco aleatorio del resumen de 300 a 1500 ms. | Automatización | Inestabilidad y lentitud. | **Corregido**: esperas por condición. |
| P3 | Las pruebas escriben en la base de desarrollo; `reuseExistingServer` se conectó en silencio a un servidor viejo (reproducido). | Automatización | Contaminación de datos y resultados falsos. | **Corregido**: base aislada por ejecución, sin reutilizar servidores, con teardown. |
| P3 | La API acepta saldo inicial negativo o no numérico (se guarda `null`) y correo sin formato; hay XSS por `innerHTML` con el nombre. | Funcional / Seguridad | Datos corruptos y ejecución de script. | **Pendiente**: fuera del alcance mínimo. |
| P4 | Persistencia JSON con lectura y escritura completas e IDs `max+1`; el mock de riesgo ignora el token. | Arquitectura | No escala con concurrencia ni varios procesos. | Riesgo aceptado para el laboratorio. |
| P4 | Trazas, video y captura siempre activos. | Automatización | Costo y ruido en los artefactos. | **Corregido**: solo en fallo. |

**Dependencias.**
- Node 20 o superior y npm con lockfile (generado).
- Express 4.
- Playwright con Chromium.
- k6 para rendimiento.
- La app se llama a sí misma como servicio de riesgo (`RISK_SERVICE_URL`).
- Puertos libres: 4310 y 4311 para E2E, 3000 para rendimiento en CI.
- En GitHub: el secreto `RISK_API_TOKEN` y, opcionalmente, las variables de puertos.

**Orden de corrección aplicado.**
1. Desbloquear la app (P1 estático).
2. Arreglar el pipeline para que pueda fallar.
3. Aislar datos y ambiente.
4. Reescribir las pruebas.
5. Rendimiento.

Lo siguiente para el equipo de desarrollo: DEF-01 y el doble gasto antes de cualquier salida a producción.
