#!/usr/bin/env bash
#
# Build and deploy the current checkout on the Pi, then restart the app.
#
#   ./pi/deploy.sh
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "[deploy] installing dependencies"
npm ci

echo "[deploy] building"
npm run build

echo "[deploy] applying migrations"
npm run db:migrate

echo "[deploy] restarting radar-app"
$SUDO systemctl restart radar-app

echo "✓ deployed. Follow logs with: journalctl -u radar-app -f"
