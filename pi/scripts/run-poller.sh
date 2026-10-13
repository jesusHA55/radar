#!/usr/bin/env bash
#
# Trigger one monitoring pass via the app's cron endpoint. Invoked by
# radar-poller.service (on a timer).
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
# shellcheck source=/dev/null
. "$REPO_DIR/pi/scripts/_env.sh"

PORT="$(env_val PORT 3000)"
CRON_SECRET="$(env_val CRON_SECRET "")"
URL="http://127.0.0.1:${PORT}/api/cron/poll"

if [ -n "$CRON_SECRET" ]; then
  curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" "$URL"
else
  curl -fsS -X POST "$URL"
fi
printf '\n'
