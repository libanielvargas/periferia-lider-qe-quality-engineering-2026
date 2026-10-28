import fs from 'node:fs';
import { TEST_DATA_DIR } from './environments.js';

// Limpieza posterior: elimina las bases JSON aisladas de la ejecución.
// KEEP_TEST_DATA=1 las conserva para depurar un fallo.
export default function globalTeardown() {
  if (process.env.KEEP_TEST_DATA === '1') return;
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
