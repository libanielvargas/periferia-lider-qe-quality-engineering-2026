import fs from 'node:fs';
import path from 'node:path';
import { TEST_DATA_DIR } from './environments.js';

// Limpieza posterior: elimina las bases JSON aisladas de la ejecución.
// Vacía la carpeta sin borrarla: en el servidor es un punto de montaje de systemd.
// KEEP_TEST_DATA=1 las conserva para depurar un fallo.
export default function globalTeardown() {
  if (process.env.KEEP_TEST_DATA === '1' || !fs.existsSync(TEST_DATA_DIR)) return;
  for (const entry of fs.readdirSync(TEST_DATA_DIR)) {
    fs.rmSync(path.join(TEST_DATA_DIR, entry), { recursive: true, force: true });
  }
}
