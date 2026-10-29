#!/usr/bin/env bash
# Instala o actualiza la entrega en el droplet de Qirava. Ejecutar EN EL VPS como root:
#   bash instalar-en-vps.sh <commit>          # despliegue
#   SOLO_INSPECCION=1 bash instalar-en-vps.sh  # solo lectura, no cambia nada
# Aditivo: no detiene ni modifica servicios existentes. Reversión: revertir-en-vps.sh
set -euo pipefail

COMMIT="${1:-main}"
REPO=https://github.com/libanielvargas/periferia-lider-qe-quality-engineering-2026.git
BASE=/opt/periferia-qe
APP=$BASE/app
PORT=3300
NODE_VERSION=22.11.0
DOMINIO=prueba-tecnica-qa-lead-periferia-it.qirava.co
CADDY_DIR=${CADDY_DIR:-/opt/qirava-portal}
# Perfil para el droplet de 1 GB (961 MiB, medido el 29-oct-2026): por encima de MEMORIA_ALTA el kernel
# recupera y pasa a swap primero las páginas de este servicio, no las de qirava.co.
MIN_DISPONIBLE_MB=${MIN_DISPONIBLE_MB:-400}
MEMORIA_ALTA=${MEMORIA_ALTA:-380M}
LIMITE_MEMORIA=${LIMITE_MEMORIA:-520M}
LIMITE_SWAP=${LIMITE_SWAP:-600M}

log() { printf '\n[periferia-qe] %s\n' "$*"; }
falla() { printf '\n[periferia-qe][ALTO] %s\n' "$*" >&2; exit 1; }

log "0. Inspección (solo lectura)"
free -m; nproc; uptime; df -h / | tail -1
ss -tlnp | awk 'NR==1 || /:(3300|4310|4311) /'
docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null || true
docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' 2>/dev/null || true
command -v node >/dev/null && node -v || echo "node del sistema: no instalado"
ufw status 2>/dev/null | head -5 || true
CADDY=$(docker ps --format '{{.Names}}' | grep -i caddy | head -1 || true)
echo "contenedor Caddy: ${CADDY:-no encontrado} · Caddyfile: $CADDY_DIR/Caddyfile"
[ -n "$CADDY" ] && docker inspect "$CADDY" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} gateway={{$v.Gateway}} {{end}}'

DISPONIBLE=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
LIBRE_DISCO=$(df -Pm / | awk 'NR==2 {print $4}')
echo "memoria disponible: ${DISPONIBLE} MiB · disco libre: ${LIBRE_DISCO} MiB"
[ "${SOLO_INSPECCION:-0}" = "1" ] && exit 0

[ "$DISPONIBLE" -ge "$MIN_DISPONIBLE_MB" ] || falla "Memoria disponible ${DISPONIBLE} MiB < ${MIN_DISPONIBLE_MB} MiB: Chromium pondría en riesgo a qirava.co. No se instala."
[ "$LIBRE_DISCO" -ge 2048 ] || falla "Menos de 2 GiB libres en disco."
ss -tln | grep -qE ":(3300|4310|4311) " && falla "Puerto 3300, 4310 o 4311 ocupado."
[ -n "$CADDY" ] || falla "No se encontró el contenedor de Caddy."
GATEWAY=$(docker inspect "$CADDY" -f '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}' | awk '{print $1}')
[ -n "$GATEWAY" ] || falla "No se pudo determinar el gateway de la red de Caddy."

log "1. Usuario y Node.js propio (no altera el Node del sistema)"
id periferia-qe >/dev/null 2>&1 || useradd --system --create-home --home-dir $BASE --shell /usr/sbin/nologin periferia-qe
if [ ! -x $BASE/node/bin/node ]; then
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C $BASE
  mv $BASE/node-v$NODE_VERSION-linux-x64 $BASE/node
fi
export PATH=$BASE/node/bin:$PATH

log "2. Código en el commit $COMMIT"
cd $BASE   # el usuario de servicio no puede leer el directorio desde donde se lanza el script
[ -d $APP/.git ] || sudo -u periferia-qe git clone -q $REPO $APP
sudo -u periferia-qe git -C $APP fetch -q origin && sudo -u periferia-qe git -C $APP checkout -q "$COMMIT"
cd $APP && sudo -u periferia-qe env PATH="$PATH" npm ci --no-audit --no-fund
npx playwright install-deps chromium
sudo -u periferia-qe env PATH="$PATH" PLAYWRIGHT_BROWSERS_PATH=$BASE/ms-playwright npx playwright install --only-shell chromium
sudo -u periferia-qe mkdir -p $APP/data $APP/runs $APP/test-data

log "3. Configuración y servicio systemd"
install -d -m 0750 -o root -g periferia-qe /etc/periferia-qe
[ -f /etc/periferia-qe/periferia-qe.env ] || {
  install -m 0640 -o root -g periferia-qe deploy/periferia-qe.env.example /etc/periferia-qe/periferia-qe.env
  sed -i "s/^RISK_API_TOKEN=.*/RISK_API_TOKEN=$(openssl rand -hex 16)/" /etc/periferia-qe/periferia-qe.env
}
sed -e "s#^ExecStart=.*#ExecStart=$BASE/node/bin/node src/server.js#" \
    -e "s#^MemoryMax=.*#MemoryMax=$LIMITE_MEMORIA#" \
    -e "s#^MemoryHigh=.*#MemoryHigh=$MEMORIA_ALTA#" \
    -e "s#^MemorySwapMax=.*#MemorySwapMax=$LIMITE_SWAP#" \
    -e "/^EnvironmentFile=/a Environment=PATH=$BASE/node/bin:/usr/local/bin:/usr/bin:/bin" \
    deploy/periferia-qe.service > /etc/systemd/system/periferia-qe.service
systemctl daemon-reload && systemctl enable --now periferia-qe && systemctl restart periferia-qe
for _ in $(seq 1 20); do curl -fsS http://127.0.0.1:$PORT/health >/dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:$PORT/health || falla "El servicio no respondió /health."

log "4. Firewall: el puerto $PORT solo desde la red de Caddy"
if ufw status 2>/dev/null | grep -q "Status: active"; then
  RED=$(docker inspect "$CADDY" -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
  SUBRED=$(docker network inspect "$RED" -f '{{(index .IPAM.Config 0).Subnet}}')
  ufw allow from "$SUBRED" to any port $PORT proto tcp comment periferia-qe
fi

log "5. Caddy: respaldo, bloque nuevo, validación y recarga (sin reiniciar el contenedor)"
cd "$CADDY_DIR"
RESPALDO=""
grep -q "^$DOMINIO" Caddyfile || {
  RESPALDO="Caddyfile.bak-periferia-qe-$(date +%Y%m%d%H%M%S)"
  cp -p Caddyfile "$RESPALDO"
  # Se escribe sobre el mismo archivo (mismo inodo): el contenedor lo monta como archivo.
  printf '\n' >> Caddyfile
  sed "s#<UPSTREAM>#$GATEWAY:$PORT#" $APP/deploy/Caddyfile.periferia-qe.snippet | grep -v '^#' >> Caddyfile
}
if ! docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  # Sin esto, el archivo inválido quedaría en disco y el próximo reinicio de Caddy tumbaría qirava.co.
  [ -n "$RESPALDO" ] && cat "$RESPALDO" > Caddyfile
  falla "El Caddyfile con el bloque nuevo no es válido. Se restauró el respaldo; Caddy no se recargó."
fi
docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

log "6. Verificación interna"
docker exec "$CADDY" wget -qO- "http://$GATEWAY:$PORT/health" && echo
systemctl --no-pager status periferia-qe | head -12
log "Listo. Desplegado $(sudo -u periferia-qe git -C $APP rev-parse --short HEAD). Falta comprobar desde Internet: https://$DOMINIO"
