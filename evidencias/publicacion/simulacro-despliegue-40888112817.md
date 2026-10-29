# Simulacro de despliegue en VPS (GitHub Actions)

- **Run:** https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/actions/runs/40888112817 (commit `fe3f21c`): **success**.
- **Topología reproducida:** Ubuntu 24.04 con systemd; Caddy 2 en contenedor `qirava-portal-caddy-1`, red `qirava-net` y Caddyfile en `/opt/qirava-portal`; un sitio existente simulado.

| Paso | Resultado |
|---|---|
| `deploy/instalar-en-vps.sh <commit>` como root | Inspección previa, Node propio, servicio systemd y bloque Caddy agregado con respaldo; `validate` y `reload` sin reiniciar Caddy. |
| Sitio existente tras la instalación | Intacto. |
| `https://prueba-tecnica-qa-lead-periferia-it.qirava.co` (a través de Caddy) | `/health` 200; la página contiene «Ejecutar la suite». |
| POST sin `Origin` | 403. |
| Ejecución desde la «página», a través de Caddy | `passed`: 13 conformes y 2 defectos conocidos; `15 passed (15.1s)`; reporte de la ejecución 200. |
| Procesos huérfanos (4310/4311) | 0. |
| Consumo del servicio (cgroup) | **Pico de memoria 595 MiB** con `MemoryMax=700M`; `CPUQuota` = 1 CPU. |
| `deploy/revertir-en-vps.sh` | Servicio inactivo, bloque retirado del Caddyfile, `/opt/periferia-qe` eliminado y sitio existente intacto. |

## Defectos propios detectados por el simulacro (corregidos)

1. `git clone` como usuario de servicio heredaba un directorio sin permisos (`f08b806`).
2. El teardown intentaba borrar `test-data`, que bajo systemd es un punto de montaje (EROFS). Ahora vacía su contenido (`24599bc`).
