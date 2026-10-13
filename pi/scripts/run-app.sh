#!/usr/bin/env bash
#
# Start the built Next.js app (production). Invoked by radar-app.service.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
# shellcheck source=/dev/null
. "$REPO_DIR/pi/scripts/_env.sh"

# Next.js loads .env.local itself for DB/SMTP/etc.; we only need the port here.
PORT="$(env_val PORT 3000)"

exec node_modules/.bin/next start -p "$PORT"
