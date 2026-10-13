#!/usr/bin/env bash
#
# Create a dedicated Postgres role + database for Radar (run once on the Pi).
#
#   RADAR_DB_PASSWORD='something-strong' ./pi/postgres-setup.sh
#
set -euo pipefail

DB_NAME="${RADAR_DB_NAME:-radar}"
DB_USER="${RADAR_DB_USER:-radar}"
DB_PASS="${RADAR_DB_PASSWORD:?set RADAR_DB_PASSWORD}"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  echo "✓ created database ${DB_NAME}"
else
  echo "• database ${DB_NAME} already exists"
fi

echo
echo "Add this to your .env.local:"
echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
