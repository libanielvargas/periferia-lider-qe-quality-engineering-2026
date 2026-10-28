import http from 'k6/http';
import { check, sleep } from 'k6';

// Parámetros por ambiente. Los valores por defecto son los del reto:
// 50 usuarios concurrentes durante 5 minutos.
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const CLIENT_ID = __ENV.CLIENT_ID || '1';
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '5m';
const THINK_TIME = Number(__ENV.THINK_TIME || 1);
const P95_MS = Number(__ENV.P95_MS || 800);

export const options = {
  scenarios: {
    resumen_cliente: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION
    }
  },
  // Umbrales automáticos: si alguno se incumple, k6 termina con código 99
  // y el job del pipeline falla.
  thresholds: {
    http_req_duration: [`p(95)<${P95_MS}`],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99']
  }
};

export function setup() {
  const response = http.get(`${BASE_URL}/api/clients/${CLIENT_ID}/summary`);
  if (response.status !== 200) {
    throw new Error(`Precondición fallida: GET /api/clients/${CLIENT_ID}/summary respondió ${response.status}`);
  }
}

export default function () {
  const response = http.get(`${BASE_URL}/api/clients/${CLIENT_ID}/summary`, {
    tags: { name: 'GET /api/clients/:id/summary' }
  });
  check(response, {
    'status 200': r => r.status === 200,
    'resumen del cliente solicitado': r => r.json('client.id') === Number(CLIENT_ID),
    'incluye conteo de operaciones': r => typeof r.json('operationCount') === 'number'
  });
  sleep(THINK_TIME);
}
