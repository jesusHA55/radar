#!/usr/bin/env bash
#
# Remove the Radar systemd services. Data (/var/lib/radar) and the repo are kept.
#
#   sudo ./pi/uninstall.sh
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo:  sudo ./pi/uninstall.sh" >&2
  exit 1
fi

UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"

systemctl disable --now radar-tunnel.service radar-app.service 2>/dev/null || true
systemctl disable --now radar-poller.timer 2>/dev/null || true

for unit in radar-app.service radar-tunnel.service radar-poller.service radar-poller.timer; do
  rm -f "$UNIT_DIR/$unit"
  echo "  removed $UNIT_DIR/$unit"
done

systemctl daemon-reload
echo "✓ uninstalled (data and repo untouched)."
