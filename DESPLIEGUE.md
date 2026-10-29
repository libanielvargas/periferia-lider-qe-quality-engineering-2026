# Despliegue en el VPS de Qirava

**Destino:** `https://prueba-tecnica-qa-lead-periferia-it.qirava.co`
**Estado:** scripts `deploy/instalar-en-vps.sh` y `deploy/revertir-en-vps.sh` verificados de punta a punta en un simulacro de la topología del droplet ([run 40888112817](https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026/actions/runs/40888112817), evidencia en `evidencias/publicacion/`). **Sin ejecutar en el VPS real**: falta un acceso SSH utilizable por el ejecutor y el registro DNS (ver «Accesos»).

**Despliegue con un solo comando** (desde la Mac, con la clave de despliegue cargada en el agente):

```bash
ssh root@206.81.7.100 'bash -s -- <commit>' < deploy/instalar-en-vps.sh      # instala; aborta si no hay recursos
ssh root@206.81.7.100 'SOLO_INSPECCION=1 bash -s' < deploy/instalar-en-vps.sh # solo lectura
ssh root@206.81.7.100 'bash -s' < deploy/revertir-en-vps.sh                   # reversión
```

**Capacidad medida:** durante la suite completa, el servicio alcanzó un pico de 595 MiB (cgroup). El script fija `MemoryMax=700M` y aborta si el droplet no tiene al menos 900 MiB disponibles con las apps de Qirava en marcha. Una nota de septiembre describe el droplet como de 1 GB; si es así, la instalación se detendrá sin tocar nada y hará falta ampliar el droplet.

## Infraestructura verificada (28-oct-2026, solo lectura)

| Elemento | Hallazgo | Cómo se verificó |
|---|---|---|
| Servidor | Droplet DigitalOcean `206.81.7.100`. Puertos 22 y 443 abiertos. | `nc -z`; runbook vigente de Belle Forme (20-oct-2026). |
| Reverse proxy | Caddy sirve `qirava.co` (`via: 1.1 Caddy`). Según el runbook corre en Docker Compose, en la red `qirava-net`. | Cabeceras HTTP; petición directa al VPS con SNI `qirava.co` → 200. |
| DNS | Zona `qirava.co` en Cloudflare (`dale` y `joselyn.ns.cloudflare.com`), con proxy activo. | `dig NS`, `dig A`. |
| Capacidad (RAM, CPU, disco, procesos) | **No verificada**: requiere SSH. | — |

## Decisión: Node.js con systemd, sin Docker

- La aplicación es Node.js puro. systemd ya existe en el servidor y aporta reinicio automático, registros en `journald` y **límites de cgroup**: `MemoryMax=1G`, `CPUQuota=100%`, `TasksMax=256`, más prioridad baja de CPU y disco.
- Esos límites contienen los picos de memoria de Chromium sin imagen de contenedor. Así se evitan unos 2 GB de imagen en el disco del servidor y el riesgo que se materializó en la Mac de desarrollo (`DECISIONES.md`, «Incidente»).
- Se agrega como servicio nuevo, con usuario, directorio y puerto propios. No toca los servicios existentes.

## Accesos

| Acceso | Estado | Qué se necesita |
|---|---|---|
| VPS (SSH) | La clave de despliegue de Qirava existe en la Mac (heredada de Mission Control, usada en septiembre de 2026), pero no está en el agente SSH, y la política de permisos del ejecutor bloquea usarla directamente desde su archivo. `doctl` responde 401. | Cargar esa clave en el agente (`ssh-add`) o autorizar al ejecutor a usarla. |
| DNS `qirava.co` (Cloudflare) | **Falta.** El `cert.pem` local solo tiene alcance de túnel, sin `Zone:DNS:Edit`. | Registro `A prueba-tecnica-qa-lead-periferia-it → 206.81.7.100` creado en el panel, o un token con `Zone:DNS:Edit`. |
| GitHub | Disponible (`gh` autenticado como `libanielvargas`). | — |
| Secretos de la app | Solo `RISK_API_TOKEN`. El mock de riesgo interno no lo valida. | Definirlo en `/etc/periferia-qe/periferia-qe.env`, nunca en el repositorio. |

## Paso 0: inspección previa (solo lectura; no continuar si algo no cabe)

```bash
free -h; nproc; uptime                      # RAM, CPU y carga
df -h / /opt                                 # disco (requiere ~600 MB: app + Chromium headless shell)
ss -tlnp                                     # puertos ocupados: 3300, 4310 y 4311 deben estar libres
systemctl list-units --type=service --state=running
docker ps --format '{{.Names}}\t{{.Status}}'; docker stats --no-stream   # consumo de Qirava
node -v; npm -v; python3 --version; docker --version
sudo ufw status verbose                      # entrada pública: solo 22, 80 y 443
docker network inspect qirava-net -f '{{(index .IPAM.Config 0).Gateway}}'
```

**Criterio para continuar:** al menos 1,5 GB de RAM disponible con las apps de Qirava en marcha (1 GB del techo de la app más margen), más de 2 GB de disco libre, Node 20 o superior, y los puertos 3300, 4310 y 4311 libres.

## Pasos

```bash
# 1. Usuario, código y dependencias (sin dependencias globales nuevas salvo las librerías de Chromium)
sudo useradd --system --create-home --home-dir /opt/periferia-qe --shell /usr/sbin/nologin periferia-qe
sudo -u periferia-qe git clone https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026.git /opt/periferia-qe/app
cd /opt/periferia-qe/app && sudo -u periferia-qe npm ci
sudo npx playwright install-deps chromium            # paquetes apt de Chromium (una vez)
sudo -u periferia-qe env PLAYWRIGHT_BROWSERS_PATH=/opt/periferia-qe/ms-playwright npx playwright install --only-shell chromium
sudo -u periferia-qe mkdir -p data runs test-data

# 2. Configuración y servicio
sudo install -d -m 0750 -o root -g periferia-qe /etc/periferia-qe
sudo install -m 0640 -o root -g periferia-qe deploy/periferia-qe.env.example /etc/periferia-qe/periferia-qe.env   # editar RISK_API_TOKEN
sudo cp deploy/periferia-qe.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now periferia-qe
curl -s http://127.0.0.1:3300/health

# 3. Caddy: respaldo, bloque nuevo y recarga (sin reiniciar el contenedor)
#    <UPSTREAM> = 127.0.0.1:3300 si Caddy corre en el host,
#    o <gateway de qirava-net>:3300 si corre en contenedor (paso 0).
cp Caddyfile Caddyfile.bak-$(date +%Y%m%d%H%M)
cat /opt/periferia-qe/app/deploy/Caddyfile.periferia-qe.snippet >> Caddyfile   # reemplazar <UPSTREAM>
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# 4. DNS: A prueba-tecnica-qa-lead-periferia-it → 206.81.7.100 (Cloudflare)
```

El servidor escucha en `0.0.0.0:3300` (comportamiento original de `server.js`). Los puertos 3300, 4310 y 4311 **no deben ser accesibles desde Internet**: confirmar con `ufw` o con el firewall de DigitalOcean que la entrada pública se limita a 22, 80 y 443.

## Verificación posterior

- [ ] `https://prueba-tecnica-qa-lead-periferia-it.qirava.co/health` responde 200 desde fuera.
- [ ] `curl -m 5 http://206.81.7.100:3300/health` desde fuera **falla** (puerto no expuesto).
- [ ] «Ejecutar suite» desde la página pública: 13 conformes y 2 defectos conocidos; el reporte muestra el mismo ID.
- [ ] `systemctl status periferia-qe` durante la corrida: memoria por debajo de 1 GB; `docker stats` de las apps de Qirava sin degradación.
- [ ] `qirava.co` y los demás *vhosts* siguen respondiendo.
- [ ] Disponible con la Mac apagada (el servicio vive en el VPS).

## Recuperación del estado anterior

```bash
cp Caddyfile.bak-<fecha> Caddyfile && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
sudo systemctl disable --now periferia-qe && sudo rm /etc/systemd/system/periferia-qe.service && sudo systemctl daemon-reload
sudo rm -rf /etc/periferia-qe /opt/periferia-qe && sudo userdel periferia-qe
# Eliminar el registro DNS en Cloudflare.
```

Es una adición sin cambios sobre los servicios existentes. El rollback consiste en retirar el bloque de Caddy y el servicio.

## Prueba de carga

La prueba de 50 usuarios durante 5 minutos **no se ejecuta contra el VPS compartido** ni se puede lanzar desde la página. Corre en GitHub Actions contra una instancia efímera (job `performance`) y su evidencia local está en `evidencias/performance/`.
