#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_HOST:?POSTGRES_HOST must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${DASHBOARD_WEB_PASSWORD:?DASHBOARD_WEB_PASSWORD must be set}"

export PGPASSWORD="$POSTGRES_PASSWORD"
until pg_isready -h "$POSTGRES_HOST" -U postgres -d dashboard >/dev/null 2>&1; do sleep 2; done

for migration in /schema/migrations/*.sql; do
  psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 -f "$migration"
done

psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 -v app_password="$DASHBOARD_WEB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE dashboard_web LOGIN PASSWORD %L IN ROLE dashboard_app',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_web')\gexec

SELECT format(
  'ALTER ROLE dashboard_web PASSWORD %L',
  :'app_password'
)
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_web')\gexec
SQL
printf 'Database schema, migrations and restricted application role are ready.\n'
