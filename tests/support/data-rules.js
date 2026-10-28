// Reglas centralizadas de generación de datos sintéticos.
// Cambiar un valor aquí modifica los datos de todas las pruebas sin tocar los specs.
export const dataRules = {
  client: {
    // La API acepta documentos de 8 a 10 dígitos. Se usa el prefijo 7 para
    // identificar datos sintéticos y 10 dígitos para minimizar colisiones.
    documentPrefix: '7',
    documentLength: 10,
    emailDomain: 'example.test',
    defaultBalance: 1000,
    firstNames: ['Ana', 'Luis', 'Marta', 'Jorge', 'Sofía', 'Andrés', 'Camila', 'Diego'],
    lastNames: ['Prueba', 'Sintético', 'Calidad', 'Ensayo', 'Validación']
  },
  operation: {
    defaultAmount: 100,
    // Comportamiento observado: una operación aprobada descuenta monto + 10 %.
    serviceChargeRate: 0.1
  },
  insufficientBalance: {
    balance: 50,
    amount: 100
  },
  // Casos inválidos para pruebas negativas de la API de clientes.
  invalidClients: [
    { case: 'sin nombre', override: { name: '' }, status: 400, error: 'name, document and email are required' },
    { case: 'sin correo', override: { email: '' }, status: 400, error: 'name, document and email are required' },
    { case: 'documento de 7 dígitos', override: { document: '1234567' }, status: 400, error: 'document must contain 8 to 10 digits' },
    { case: 'documento de 11 dígitos', override: { document: '12345678901' }, status: 400, error: 'document must contain 8 to 10 digits' },
    { case: 'documento con letras', override: { document: '12345abcde' }, status: 400, error: 'document must contain 8 to 10 digits' }
  ],
  invalidAmounts: [
    { case: 'monto cero', amount: 0, status: 400, error: 'amount must be greater than zero' },
    { case: 'monto negativo', amount: -10, status: 400, error: 'amount must be greater than zero' },
    { case: 'monto no numérico', amount: 'abc', status: 400, error: 'amount must be greater than zero' }
  ]
};
