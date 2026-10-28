# Revisión del pull request

**Archivo revisado:** `review-target/payment-helper.js`
**Decisión:** 🔴 **SOLICITAR CAMBIOS BLOQUEANTES** (detalle al final).

## Hallazgos

| # | Ubicación | Severidad | Hallazgo | Riesgo / impacto | Recomendación concreta |
|---|---|---|---|---|---|
| 1 | L1 (`adminPassword`), usada en L11 y L26 | **Crítica** | Contraseña de administrador en texto plano dentro del código. | Queda en el historial de Git y en cualquier fork o clon. Da acceso privilegiado a quien lea el repositorio. | Retirarla del código y **rotar la credencial ya**, porque quedó expuesta en el PR. Inyectarla como secreto (`process.env` o `secrets.*` en CI) o autenticar con `storageState` o login por API. |
| 2 | L2 (`baseUrl`), usada en L5 y L20 | **Crítica** | La URL de **producción** está fija en un helper de automatización que crea pagos con credenciales de administrador. | Una ejecución local o de CI puede crear **pagos reales en producción**. Además, impide ejecutar contra QA o staging. | Usar `baseURL` de `playwright.config` o parametrizarla por ambiente, y agregar una salvaguarda que aborte si el host es productivo. |
| 3 | L7-L9 y L22-L24 | **Alta** | Datos personales con apariencia real: una cédula con formato colombiano válido, un nombre y un correo de un dominio real. | Incumplimiento potencial de la Ley 1581 de 2012 (habeas data). Además, el documento fijo genera duplicados y acopla las pruebas entre sí. | Usar la fábrica de datos sintéticos (`tests/support/data-factory.js`), con documentos únicos y el dominio reservado `example.test`. |
| 4 | L14-L16 y L29 | **Alta** | Oráculo falso. `createPayment` devuelve `true` con **cualquier** texto, incluido un mensaje de error. En L29, si `textContent()` es `null`, `null !== ''` da `true`. | Las pruebas pasan aunque el pago falle: es un falso verde en un flujo financiero. | No devolver booleanos. Afirmar con `expect` el resultado de negocio (estado, monto, referencia), devolver el identificador del pago y confirmarlo por API. |
| 5 | L6, L13, L21 y L28 | **Media** | `waitForTimeout(5000)` y `waitForTimeout(8000)`: 13 s fijos por llamada. | Pruebas lentas e inestables: fallan si el sistema tarda más y desperdician tiempo si tarda menos. | Usar esperas por condición (`await expect(locator).toHaveText(...)`, `page.waitForResponse`). |
| 6 | L4-L17 frente a L19-L30 | **Media** | `createSecondPayment` duplica `createPayment` con otra condición de retorno. | Divergencia de comportamiento y doble mantenimiento: ya hoy las dos funciones devuelven cosas distintas ante el mismo resultado. | Una sola función parametrizada con un objeto `{ customer, amount }`. |
| 7 | Todo el archivo | **Media** | El helper mezcla navegación, datos, autenticación y validación, y la contraseña se escribe en el formulario de pago. | Es difícil de reutilizar y de auditar, y la autenticación queda acoplada a cada pago. | Separar un Page Object (localizadores y acciones), los datos (fábrica) y la sesión (fixture de autenticación). |
| 8 | L7-L12 | **Baja** | Los selectores (`#customer-document`, `#submit`, `.message`) no existen en la aplicación de este repositorio, y `.message` es un selector genérico. | El helper no es ejecutable aquí, lo que sugiere que no se probó. Un selector genérico puede capturar un mensaje equivocado. | Usar selectores por rol o `data-testid` y adjuntar en el PR la evidencia de ejecución. |
| 9 | L4 y L19 | **Baja** | `amount` sin validación ni documentación, y nombres de funciones sin intención de negocio. | Se pueden enviar montos inválidos sin intención explícita. | Agregar JSDoc o tipos y validar la entrada, o delegar los montos inválidos a pruebas negativas explícitas. |

## Propuesta de forma esperada

```js
// tests/pages/payments-page.js
export class PaymentsPage {
  constructor(page) { /* localizadores por rol / data-testid */ }
  async createPayment({ customer, amount }) {
    await this.page.goto('/payments');
    // ...fill con datos sintéticos...
    await this.submit.click();
    await expect(this.result).toHaveText(/^Pago \d+: APROBADO$/);
    return Number((await this.result.textContent()).match(/\d+/)[0]);
  }
}
// La prueba confirma luego el pago por API (estado, monto, cliente).
```

## Decisión final

**Solicito cambios bloqueantes; el PR no se aprueba.** Hay dos hallazgos críticos de seguridad y operación: una credencial expuesta (#1) y la posibilidad de transaccionar contra producción (#2). Además, el oráculo es falso (#4) y hace que el helper reporte éxito sin validar nada, así que agrega riesgo en lugar de cobertura. No lo **rechazo** de plano porque la intención, tener un helper reutilizable para pagos, es válida y se puede corregir dentro del mismo PR.

**Condiciones para aprobar:**
1. Credencial rotada y fuera del código y del historial.
2. URL parametrizada, con la salvaguarda antiproducción.
3. Datos sintéticos.
4. Aserciones de negocio con confirmación por API.
5. Sin esperas fijas.
6. Una sola función.
7. Evidencia de ejecución verde en el pipeline.

Los puntos 1 y 2 se atienden de inmediato aunque el PR se cierre, porque la exposición de la credencial ya ocurrió.
