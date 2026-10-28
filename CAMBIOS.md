# Orden de trabajo

El historial de Git (`git log --reverse`) es la fuente principal. Este resumen sigue el mismo orden.

1. **Baseline:** el repositorio entregado, sin modificaciones.
2. **Instalación:** `npm install` genera `package-lock.json`. Se ejecuta la suite original dos veces, con reset y sin reset: 4 de 4 fallan, con evidencia en `evidencias/baseline/`.
3. **Causa raíz:** `GET /` respondía 404 por una ruta con espacio. Corrección con `fileURLToPath` y nueva corrida de la suite original para exponer la segunda capa de fallas.
4. **Corrección del `PENDING` fijo** en el resumen de la interfaz.
5. **Suite E2E nueva:** Page Object, cliente API, fábrica de datos con reglas centralizadas, proyectos `approved` y `rejected` con base aislada, y teardown. Evidencia de estabilidad (`--repeat-each=5`: 70 de 70) y de detección de regresión (mutación del `PENDING`).
6. **Rendimiento, pipeline y revisión:** prueba k6 con umbrales, pipeline corregido, `REVISION_PR.md` y `DIAGNOSTICO.md` con el sondeo de defectos de la API.
7. **Cierre:** corrida completa de k6 (50 VUs, 5 min), simulación local de los pasos del pipeline, reporte final y `DECISIONES.md`.
