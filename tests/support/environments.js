export const TEST_DATA_DIR = 'test-data';

// Cada modo de riesgo levanta su propio servidor con una base JSON aislada.
export const environments = {
  approved: { port: Number(process.env.E2E_PORT_APPROVED || 4310), riskMode: 'approved' },
  rejected: { port: Number(process.env.E2E_PORT_REJECTED || 4311), riskMode: 'rejected' }
};

export function baseUrl({ port }) {
  return `http://127.0.0.1:${port}`;
}

export function webServerFor(environment) {
  const url = baseUrl(environment);
  return {
    command: 'node scripts/reset-db.js && node src/server.js',
    url: `${url}/health`,
    // Nunca reutilizar: un servidor ajeno tendría otra base y otro RISK_MODE.
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      PORT: String(environment.port),
      DATABASE_PATH: `${TEST_DATA_DIR}/e2e-${environment.riskMode}.json`,
      RISK_MODE: environment.riskMode,
      RISK_SERVICE_URL: `${url}/external/risk`,
      RISK_API_TOKEN: process.env.RISK_API_TOKEN || 'local-test-token'
    }
  };
}
