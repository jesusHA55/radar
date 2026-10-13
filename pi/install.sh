#!/usr/bin/env bash
#
# Install Radar as systemd services on a Raspberry Pi (Raspberry Pi OS).
#
#   sudo ./pi/install.sh
#
# Overridable:  RADAR_DIR  RADAR_USER  UNIT_DIR
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo:  sudo ./pi/install.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RADAR_DIR="${RADAR_DIR:-$REPO_DIR}"
RADAR_USER="${RADAR_USER:-${SUDO_USER:-$(id -un)}}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
STATE_DIR="/var/lib/radar"

echo "[install] repo   : $RADAR_DIR"
echo "[install] user   : $RADAR_USER"
echo "[install] units  : $UNIT_DIR"
echo

echo "[install] checking tools"
missing=0
for bin in node npm cloudflared; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "  ✓ $bin -> $(command -v "$bin")"
  else
    echo "  ✗ $bin not found in PATH"
    missing=1
  fi
done
command -v psql >/dev/null 2>&1 || echo "  ! psql not found (install the postgresql package)"
[ "$missing" -eq 1 ] && { echo; echo "Install the missing tools first (see pi/README.md)." >&2; exit 1; }

if [ ! -f "$RADAR_DIR/.env.local" ]; then
  echo "  ! $RADAR_DIR/.env.local is missing — copy pi/env.example and fill it in" >&2
fi
if [ ! -d "$RADAR_DIR/.next" ]; then
  echo "  ! no production build found — run 'npm run build' (or pi/deploy.sh)" >&2
fi

echo
echo "[install] preparing directories"
chmod +x "$RADAR_DIR"/pi/scripts/*.sh
mkdir -p "$STATE_DIR"
chown "$RADAR_USER":"$RADAR_USER" "$STATE_DIR"
echo "  ✓ $STATE_DIR"

echo
echo "[install] rendering units"
for unit in radar-app.service radar-tunnel.service radar-poller.service radar-poller.timer; do
  sed -e "s|__RADAR_DIR__|$RADAR_DIR|g" \
      -e "s|__RADAR_USER__|$RADAR_USER|g" \
      "$RADAR_DIR/pi/systemd/${unit}.template" > "$UNIT_DIR/$unit"
  echo "  → $UNIT_DIR/$unit"
done

systemctl daemon-reload
systemctl enable --now radar-app.service radar-tunnel.service
systemctl enable --now radar-poller.timer

echo
echo "✓ installed."
echo "  status : systemctl status radar-app radar-tunnel"
echo "  timers : systemctl list-timers radar-poller.timer"
echo "  logs   : journalctl -u radar-app -f"
echo "  url    : cat /var/lib/radar/tunnel-url.txt   (after the tunnel starts)"
