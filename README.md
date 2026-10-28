# Prueba técnica asincrónica: rescate de una suite de calidad

## Para la persona evaluadora: una sola entrada

Tras instalar dependencias (`npm ci` y `npx playwright install chromium`), inicia `npm start` y abre **http://127.0.0.1:3000**.

La portada del mismo laboratorio, con identidad visual inspirada en Periferia IT Group, reúne:

1. La aplicación bajo prueba (crear cliente, ejecutar operación, consultar resumen).
2. Un botón **«Ejecutar suite»** que lanza Playwright REAL y muestra los pasos y el tiempo de la ejecución. Por seguridad funciona solo desde localhost, nunca por un túnel público.
3. El reporte Playwright con evidencia y pasos descriptivos.
4. Enlaces a los entregables: diagnóstico, decisiones, revisión de PR e historial de cambios.

El reporte completo refleja **13 escenarios conformes y 1 escenario con fallo esperado (XFAIL)** para documentar que la aplicación permite saldos negativos. También existe riesgo demostrado de doble gasto concurrente. No se afirma que la aplicación sea apta para producción. El pipeline está validado localmente, pero no existe aún evidencia de una ejecución real en GitHub Actions.

La interfaz de presentación es una ayuda para recorrer la entrega; las pruebas y fuentes de verdad siguen siendo los artefactos del repositorio.


## Objetivo

Evaluar la capacidad para diagnosticar, automatizar, estabilizar y gobernar una solución de pruebas existente.

## Condiciones

- Dedicación esperada: máximo 3 horas.
- Ventana de entrega: 48 horas desde la recepción.
- Trabajo individual.
- Puedes usar documentación y asistentes de inteligencia artificial. Debes declarar su uso en `DECISIONES.md`.
- No se espera que agregues funcionalidades distintas a las solicitadas.
- Si no completas una actividad, documenta qué quedó pendiente, el riesgo y la acción siguiente.

## Aplicación entregada

El repositorio contiene:

- Frontend web.
- APIs para clientes y operaciones.
- Base de datos de prueba persistida en archivo JSON.
- Integración con un servicio externo de riesgo simulable.
- Suite Playwright parcialmente construida.
- Pipeline de integración continua.
- Archivo de código para revisión técnica.

## Requisitos locales

- Node.js 20 o superior.
- npm.
- Playwright Chromium.
- k6 o JMeter para el reto de rendimiento.

## Inicio rápido

```bash
npm install
npx playwright install chromium
npm run db:reset
npm start
```

Aplicación: `http://127.0.0.1:3000`

Para ejecutar la suite existente:

```bash
npm run test:e2e
```

## Reto 1: diagnóstico del arnés — 30 minutos

Levanta el proyecto, ejecuta las pruebas y determina:

- Por qué fallan las pruebas.
- Cuáles hallazgos son defectos funcionales y cuáles pertenecen a la automatización.
- Qué dependencias requiere la solución.
- Qué riesgos existen en el diseño actual.
- Qué corregirías primero.

Entrega el resultado en `DIAGNOSTICO.md`, con una extensión máxima de una página.

## Reto 2: automatización funcional — 45 minutos

Automatiza el flujo completo:

> Crear un cliente, realizar una operación, validar el resultado en la interfaz y confirmar el registro mediante API.

La solución debe contemplar:

- Componentes reutilizables o Page Objects.
- Validaciones con sentido de negocio.
- Evidencias del resultado.
- Esperas basadas en condiciones.
- Independencia entre pruebas.
- Ejecución local y en pipeline.

La evaluación considera confiabilidad, legibilidad y mantenibilidad, no únicamente que la prueba termine correctamente.

## Reto 3: datos sintéticos — 30 minutos

Reemplaza los datos quemados por un generador capaz de producir:

- Clientes válidos.
- Documentos únicos.
- Clientes con saldo insuficiente.
- Datos inválidos para pruebas negativas.
- Limpieza posterior a la ejecución.

La solución debe centralizar las reglas de generación y permitir modificarlas sin cambiar las pruebas. Documenta en `DECISIONES.md` la estrategia aplicada y sus limitaciones.

## Reto 4: prueba no funcional — 30 minutos

Crea en la carpeta `performance` una prueba para `GET /api/clients/1/summary` con k6 o JMeter:

- 50 usuarios concurrentes.
- Duración de cinco minutos.
- Tiempo de respuesta objetivo menor a 800 ms.
- Tasa de error inferior al 1 %.

Configura umbrales automáticos y explica cuándo debe bloquearse el pipeline. Si la ejecución completa excede el tiempo disponible, entrega el script configurado y evidencia de una ejecución reducida.

## Reto 5: reparación del pipeline — 30 minutos

Ajusta el pipeline para que:

- Ejecute correctamente las pruebas.
- Publique el reporte.
- Conserve videos, capturas y trazas solo cuando ocurra un fallo.
- Parametrice secretos y ambientes.
- Falle cuando se incumplan pruebas o umbrales de rendimiento.

Si no puedes ejecutar GitHub Actions, entrega el archivo corregido y documenta cómo validaste su comportamiento.

## Reto 6: liderazgo técnico — 15 minutos

Revisa `review-target/payment-helper.js` y registra los comentarios en `REVISION_PR.md`.

Clasifica los riesgos, recomienda correcciones y decide si apruebas, solicitas cambios o rechazas el pull request.

## Entrega

Envía:

- Repositorio o archivo ZIP.
- Código modificado.
- `DIAGNOSTICO.md`.
- `DECISIONES.md`.
- `REVISION_PR.md`.
- Reportes y evidencias generadas.
- Historial de commits o un archivo `CAMBIOS.md` con el orden de trabajo.

No incluyas bases de datos con información personal real, contraseñas o tokens.
