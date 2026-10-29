# Orden de trabajo

El historial de Git (`git log --reverse`) es la fuente principal. Este resumen sigue el mismo orden.

1. **Baseline:** el repositorio entregado, sin modificaciones.
2. **Instalación:** `npm install` genera `package-lock.json`. Se ejecuta la suite original dos veces, con reset y sin reset: 4 de 4 fallan, con evidencia en `evidencias/baseline/`.
3. **Causa raíz:** `GET /` respondía 404 por una ruta con espacio. Corrección con `fileURLToPath` y nueva corrida de la suite original para exponer la segunda capa de fallas.
4. **Corrección del `PENDING` fijo** en el resumen de la interfaz.
5. **Suite E2E nueva:** Page Object, cliente API, fábrica de datos con reglas centralizadas, proyectos `approved` y `rejected` con base aislada, y teardown. Evidencia de estabilidad (`--repeat-each=5`: 70 de 70) y de detección de regresión (mutación del `PENDING`).
6. **Rendimiento, pipeline y revisión:** prueba k6 con umbrales, pipeline corregido, `REVISION_PR.md` y `DIAGNOSTICO.md` con el sondeo de defectos de la API.
7. **Cierre:** corrida completa de k6 (50 VUs, 5 min), simulación local de los pasos del pipeline, reporte final y `DECISIONES.md`.

## Fase 2: presentación, ejecutor público y publicación (fuera de las 3 h del reto)

8. **Snapshot de auditoría** (`df8edc6`): se conservó tal cual el trabajo de una sesión previa, que había mezclado la presentación con `app.js` y `styles.css`.
9. **Separación de la presentación:** `app.js` y `styles.css` vuelven a su versión del reto (el original más la corrección del `PENDING`); la capa nueva vive en `index.html`, `revision.css` y `revision.js`. Incluye el favicon transparente, la foto del autor y el hero con tres escenas en WebP.
10. **Ejecutor público** (`src/qa-runner.js`): comando fijo, candado, enfriamiento, límites por IP y por hora, verificación de origen, apagado en dos fases y reporte con ID por ejecución. 18 verificaciones en `evidencias/e2e/ejecutor-publico-seguridad.txt`.
11. **DEF-02 automatizado** como fallo esperado. Los títulos de DEF-01 y DEF-02 lo dicen de forma explícita. Estabilidad: 75 de 75, con DEF-02 reproducido 5 de 5.
12. **Incidente de disco:** una construcción Docker llenó el disco de la Mac. Se liberaron solo cachés autorizadas y se descartó Docker: el despliegue pasa a Node.js con systemd (`DESPLIEGUE.md`).
13. **Documentación:** README para lectores nuevos, enunciado original en `ENUNCIADO.md` y publicación en GitHub.
14. **Ejecutor (29-oct):** la causa real de «No fue posible consultar el estado del ejecutor» fue un proceso de Node iniciado antes de que existiera el ejecutor. La interfaz ahora explica cada tipo de falla (`DECISIONES.md`).
15. **Presentación en primera persona:** punto de partida con los hechos de las 4 pruebas originales, tabla de mediciones con contexto, defectos con estructura completa (`DEFECTOS.md`) y capturas reales de su reproducción.
16. **Aplicación:**
    - Confirmaciones con los datos que devuelve la API.
    - Selector de clientes sin preselección y sin el valor 100 precargado.
    - Valores en pesos colombianos.
    - Historial completo de `GET /api/clients/:id/summary`.

    Sin cambios en el backend ni en `app.js`.
17. **Perfil del droplet de 1 GB:** `MemoryHigh` 380M, `MemoryMax` 520M y swap propio de 600M. El ejecutor no lanza Chromium si el servidor tiene menos de 350 MiB libres.
18. **Publicación:** registro DNS creado, certificado emitido y suite ejecutada desde el botón de https://prueba-tecnica-qa-lead-periferia-it.qirava.co (`20261029-212552-d363`): 13 conformes y 2 defectos conocidos.
