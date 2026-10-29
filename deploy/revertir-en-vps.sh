#!/usr/bin/env bash
# Revierte el despliegue de la entrega en el VPS, dejando el servidor como estaba. Ejecutar como root.
set -euo pipefail
CADDY_DIR=${CADDY_DIR:-/opt/qirava-portal}
CADDY=$(docker ps --format '{{.Names}}' | grep -i caddy | head -1)

ULTIMO=$(ls -t "$CADDY_DIR"/Caddyfile.bak-periferia-qe-* 2>/dev/null | head -1 || true)
if [ -n "$ULTIMO" ]; then
  cp "$ULTIMO" "$CADDY_DIR/Caddyfile"
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi
systemctl disable --now periferia-qe 2>/dev/null || true
rm -f /etc/systemd/system/periferia-qe.service && systemctl daemon-reload
ufw status 2>/dev/null | grep -q "Status: active" && ufw status numbered | grep periferia-qe | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn | xargs -r -I{} ufw --force delete {}
rm -rf /etc/periferia-qe /opt/periferia-qe
id periferia-qe >/dev/null 2>&1 && userdel periferia-qe
echo "Revertido. Eliminar además el registro DNS prueba-tecnica-qa-lead-periferia-it en Cloudflare."
