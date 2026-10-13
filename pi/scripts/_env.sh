#
# Small helper for the Pi scripts: read a single KEY from .env.local without
# shell-sourcing the whole file (values like `MAIL_FROM=Radar <you@gmail.com>`
# would otherwise be interpreted as shell syntax).
#
env_val() {
  # env_val KEY [default]
  local key="$1" def="${2:-}"
  local line
  line="$(grep -E "^[[:space:]]*${key}=" .env.local 2>/dev/null | tail -n1 || true)"
  if [ -z "$line" ]; then
    printf '%s' "$def"
    return
  fi
  printf '%s' "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}
