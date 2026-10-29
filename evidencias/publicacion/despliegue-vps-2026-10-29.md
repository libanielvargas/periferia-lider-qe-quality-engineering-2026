# Despliegue en el VPS de Qirava (29-oct-2026)

Todas las cifras de este documento se midieron en el servidor real. No incluye valores de secretos.

## Servidor (inspección previa, solo lectura)

| Recurso | Valor medido |
|---|---|
| Proveedor y sistema | DigitalOcean, Ubuntu 24.04, systemd 255, cgroup v2 |
| CPU | 1 vCPU |
| RAM | 961 MiB en total; 450 a 470 MiB disponibles con las apps de Qirava en marcha |
| Swap | 2 047 MiB (170 MiB en uso antes de instalar) |
| Disco | 24 GB; 7,7 GB libres (67 % usado) |
| Servicios existentes | Contenedores `qirava-portal-qirava-portal-1` (149 MiB) y `qirava-portal-caddy-1` (15 MiB), ambos activos desde hace 3 semanas |
| Firewall del host | Política `INPUT ACCEPT` y ufw inactivo |
| Caddy | Docker Compose en `/opt/qirava-portal`; un sitio (`qirava.co`, con redirección `www`); certificados de Let's Encrypt |

## Decisiones derivadas de la inspección

- **Memoria.** El perfil inicial (700M sin swap) no cabía en 961 MiB. Dejé el servicio con `MemoryHigh=380M`, `MemoryMax=520M` y `MemorySwapMax=600M`: por encima de 380M, el kernel recupera y pasa a swap primero las páginas de este servicio y no las del portal. Además, el ejecutor no lanza Chromium si el servidor tiene menos de 350 MiB libres.
- **Red.** Como el host no tiene firewall y `server.js` (archivo del evaluador) escucha en `0.0.0.0`, limité el servicio con `IPAddressDeny=any` e `IPAddressAllow=localhost 172.16.0.0/12`. El filtro aplica solo a este servicio, incluidos los servidores de prueba en 4310 y 4311, y no toca el firewall compartido.
- **Fuente tipográfica.** El filtro de red reveló que la página dependía de Google Fonts. La fuente Outfit se sirve ahora desde la aplicación (commit `43f6f52`).
- **Caddy.** Si el bloque nuevo no valida, el instalador restaura el respaldo antes de salir (commit `e33bc04`).

Cada cambio pasó primero por el simulacro de GitHub Actions, que reproduce esa topología. En la ejecución `40933707161`, con el mismo perfil de memoria, la suite dio 13 conformes y 2 defectos conocidos, con un pico de 381,8 MiB, y el puerto 3300 no respondió desde fuera de la red de Caddy.

## Instalación

- **Comando:** `ssh root@206.81.7.100 'bash -s -- e33bc04' < deploy/instalar-en-vps.sh`. Terminó con código 0.
- **Servicio:** `periferia-qe` quedó activo (`high 380M · max 520M · swap max 600M`).
- **Caddy:** el diff del Caddyfile contra su respaldo solo muestra el bloque nuevo al final. Caddy recargó sin reiniciar el contenedor.
- **Desde Internet:** `http://206.81.7.100:3300/health` no responde.
- **Servicios existentes después de instalar:** `https://qirava.co/` → 200 y `https://www.qirava.co/` → 301, igual que antes. Ambos contenedores siguen activos.

## Ejecución real de la suite en el VPS

La lancé desde la página desplegada, presionando el botón con Playwright a través de un túnel SSH a `127.0.0.1:3300`, porque el DNS todavía no existía.

| Medición | Resultado |
|---|---|
| ID de la ejecución | `20261029-185108-9328` |
| Resultado | `passed`: 13 conformes, 2 defectos conocidos (DEF-01 y DEF-02), 0 fallidas |
| Duración | 62 s (25 s en el simulacro de CI, con más CPU y RAM) |
| Reporte | `/revision/ejecuciones/20261029-185108-9328/reporte/`, 543 KB, HTTP 200 |
| Procesos huérfanos en 4310 y 4311 | 0 |
| Memoria del servicio | Pico de cgroup de 380 MiB; hasta 360 MiB en swap propio |
| Memoria disponible del servidor | Mínimo de 241 MiB durante la ejecución; volvió a unos 519 MiB al terminar |
| Carga del sistema | Máximo de 2,57 (promedio de 1 minuto, 1 vCPU) |
| `qirava.co` durante la ejecución | 50 de 50 respuestas HTTP 200; promedio de 0,64 s y máximo de 1,64 s (antes de instalar: 0,37 a 0,82 s) |

**Lectura.** El droplet de 1 GB aloja la suite sin errores en el portal, pero con poco margen: durante la ejecución el portal responde más lento, y la ejecución tarda más del doble que en CI porque el servicio trabaja con swap. Justo después de una ejecución, la primera carga del reporte puede tardar mientras el proceso recupera memoria del swap; en una consulta posterior tardó 1,3 s. Si la página va a recibir uso frecuente, la medida correcta es ampliar el droplet a 2 GB. Es una decisión de costo del propietario.

## Pendiente

- **Registro DNS** `A prueba-tecnica-qa-lead-periferia-it → 206.81.7.100` en Cloudflare, con proxy activo. Mientras no exista, Caddy no puede emitir el certificado (`NXDOMAIN` en sus registros) y la URL pública no resuelve.
