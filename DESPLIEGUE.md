# Despliegue en el VPS de Qirava

**Destino:** `https://prueba-tecnica-qa-lead-periferia-it.qirava.co`

**Estado (29-oct-2026):**
- **Servicio instalado en el VPS:** commit `e33bc04`. La suite se ejecutó en el servidor desde la página desplegada: 13 conformes y 2 defectos conocidos. El detalle y la evidencia están en `evidencias/publicacion/despliegue-vps-2026-10-29.md`.
- **Pendiente:** crear el registro DNS en Cloudflare. Sin él, la URL no resuelve y Caddy no puede emitir el certificado.

## Comandos (desde la Mac, con la clave de despliegue de Qirava)

```bash
ssh root@206.81.7.100 'SOLO_INSPECCION=1 bash -s' < deploy/instalar-en-vps.sh  # solo lectura
ssh root@206.81.7.100 'bash -s -- <commit>' < deploy/instalar-en-vps.sh        # instala o actualiza
ssh root@206.81.7.100 'bash -s' < deploy/revertir-en-vps.sh                    # reversión completa
```

## Servidor medido (29-oct-2026)

| Recurso | Valor |
|---|---|
| Servidor | Droplet de DigitalOcean `206.81.7.100`, Ubuntu 24.04, systemd 255, cgroup v2 |
| CPU y RAM | 1 vCPU · 961 MiB (450 a 470 MiB disponibles con el portal en marcha) · swap de 2 GiB |
| Disco | 24 GB, 7,7 GB libres |
| Servicios existentes | `qirava-portal` y `caddy` en Docker Compose (`/opt/qirava-portal`) |
| Firewall del host | No hay (`INPUT ACCEPT`, ufw inactivo) |
| DNS | Zona `qirava.co` en Cloudflare, con proxy |

## Decisión: Node.js con systemd, sin Docker

- La aplicación es Node.js puro. systemd aporta reinicio automático, registros en `journald` y límites de cgroup sin construir una imagen. Construir una imagen fue lo que llenó el disco de la Mac (`DECISIONES.md`, «Incidente»).
- **Servicio aditivo:** usuario, directorio, puerto (3300) y Node propios (`/opt/periferia-qe/node`). No modifica los servicios existentes.
- **Memoria:** `MemoryHigh=380M`, `MemoryMax=520M` y `MemorySwapMax=600M`. Por encima de 380M, el kernel recupera primero la memoria de este servicio, no la del portal. El ejecutor no lanza Chromium si el servidor tiene menos de 350 MiB libres (`QA_RUNNER_MIN_FREE_MB`).
- **Red:** `IPAddressDeny=any` e `IPAddressAllow=localhost 172.16.0.0/12`. Solo Caddy (red Docker) y localhost llegan al servicio, incluidos los servidores de prueba en 4310 y 4311, y el servicio tampoco sale a Internet. No se modifica el firewall compartido.
- **Prioridad:** `Nice=10` e `IOWeight=50`. El portal conserva la prioridad de CPU y disco.

## Qué hace el instalador (`deploy/instalar-en-vps.sh`)

0. **Inspección de solo lectura.** Aborta si hay menos de 400 MiB disponibles, menos de 2 GiB de disco, si los puertos 3300, 4310 o 4311 están ocupados o si no encuentra el contenedor de Caddy.
1. **Usuario y runtime.** Crea el usuario de sistema `periferia-qe` y descarga Node 22.11.0 en `/opt/periferia-qe/node`.
2. **Código y dependencias.**
   - Clona el repositorio en el commit indicado y ejecuta `npm ci`.
   - Instala las librerías del sistema que necesita Chromium (`playwright install-deps`). Solo agrega paquetes con apt; no actualiza ni reinicia nada.
   - Descarga Chromium headless en `/opt/periferia-qe/ms-playwright`.
3. **Configuración y servicio.**
   - Crea `/etc/periferia-qe/periferia-qe.env`, propiedad de root con permisos 0640, y le asigna un token aleatorio que nunca se imprime.
   - Instala la unidad systemd y arranca el servicio.
4. **Firewall.** Si ufw está activo, permite el puerto 3300 solo desde la subred de Caddy. En este droplet ufw está inactivo, así que el paso no hace nada.
5. **Caddy.**
   - Respalda el Caddyfile.
   - Agrega el bloque de `deploy/Caddyfile.periferia-qe.snippet` escribiendo sobre el mismo archivo, porque el contenedor lo monta por inodo.
   - Valida la configuración. **Si no valida, restaura el respaldo y se detiene sin recargar.**
   - Si valida, recarga Caddy sin reiniciar el contenedor.
6. **Verificación interna.** Comprueba `/health` desde el contenedor de Caddy.

La reversión (`deploy/revertir-en-vps.sh`) hace lo siguiente:
- Restaura el último respaldo del Caddyfile y recarga Caddy.
- Detiene y elimina el servicio.
- Borra `/etc/periferia-qe`, `/opt/periferia-qe` y el usuario.

## Verificación

- [x] El simulacro en GitHub Actions con la topología del droplet y el mismo perfil de memoria pasó (`40933707161`): suite a través de Caddy, 13 conformes y 2 defectos conocidos, y reversión limpia.
- [x] Instalación real en el VPS con código de salida 0. El servicio está activo con los límites esperados.
- [x] El puerto 3300 no responde desde Internet.
- [x] Ejecución real de la suite en el VPS (`20261029-185108-9328`): 13 conformes y 2 defectos conocidos en 62 s, reporte con el mismo ID y 0 procesos huérfanos.
- [x] `qirava.co` respondió 200 en las 50 muestras tomadas durante la ejecución, con un máximo de 1,64 s.
- [ ] Crear el registro DNS `A prueba-tecnica-qa-lead-periferia-it → 206.81.7.100` en Cloudflare, con proxy activo.
- [ ] Confirmar que Caddy emitió el certificado y que `https://prueba-tecnica-qa-lead-periferia-it.qirava.co/health` responde 200 desde Internet.
- [ ] Ejecutar la suite desde la URL pública.

## Capacidad y riesgo

El droplet de 1 GB aloja la suite sin errores en el portal, pero con poco margen. Durante una ejecución, el portal responde más lento (máximo de 1,64 s frente a 0,37 a 0,82 s antes de instalar) y la suite tarda 62 s, frente a 25 s en CI, porque el servicio trabaja con swap. Los límites del ejecutor reducen la exposición: una ejecución a la vez, 90 s de espera entre ejecuciones y un máximo de 15 por hora. Si la página va a tener uso frecuente, conviene ampliar el droplet a 2 GB; es una decisión de costo del propietario.

## Accesos

| Acceso | Mecanismo | Estado |
|---|---|---|
| VPS (SSH) | Clave de despliegue de Qirava (`root`), autorizada por el propietario para este despliegue | Utilizada el 29-oct-2026 |
| DNS `qirava.co` | Panel de Cloudflare (manual); no hay token con `Zone:DNS:Edit` | Pendiente: crear el registro |
| GitHub | `gh` autenticado como `libanielvargas` | Disponible |
| Secretos de la app | `RISK_API_TOKEN` en `/etc/periferia-qe/periferia-qe.env`, generado en el servidor | Nunca en el repositorio |

## Prueba de carga

La prueba de 50 usuarios durante 5 minutos **no se ejecuta contra el VPS compartido** ni se puede lanzar desde la página. Corre en GitHub Actions contra una instancia efímera (job `performance`), y su evidencia local está en `evidencias/performance/`.
