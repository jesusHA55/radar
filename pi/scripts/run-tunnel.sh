#!/usr/bin/env bash
#
# Run a Cloudflare *quick* tunnel to the local app and capture the public URL to
# a file (so /settings and you can find it). Invoked by radar-tunnel.service.
#
# The URL changes on every restart — that is a property of quick tunnels.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
# shellcheck source=/dev/null
. "$REPO_DIR/pi/scripts/_env.sh"

PORT="$(env_val PORT 3000)"
OUT="$(env_val TUNNEL_URL_FILE /var/lib/radar/tunnel-url.txt)"
mkdir -p "$(dirname "$OUT")"
: > "$OUT"

# cloudflared prints the URL to stderr; tee it and scrape it line by line.
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}" 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  if [[ "$line" =~ (https://[a-z0-9-]+\.trycloudflare\.com) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}" > "$OUT"
  fi
done
