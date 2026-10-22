#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_HOST:?POSTGRES_HOST must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${DASHBOARD_WEB_PASSWORD:?DASHBOARD_WEB_PASSWORD must be set}"

export PGPASSWORD="$POSTGRES_PASSWORD"
until pg_isready -h "$POSTGRES_HOST" -U postgres -d dashboard >/dev/null 2>&1; do sleep 2; done

# Ensure the migrations ledger exists
psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  migration_name VARCHAR(255) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for migration in /schema/migrations/*.sql; do
  migration_name="$(basename "$migration")"
  checksum="$(sha256sum "$migration" | awk '{print $1}')"

  applied="$(psql -h "$POSTGRES_HOST" -U postgres -d dashboard -X -A -t -v ON_ERROR_STOP=1 \
    -v name="$migration_name" \
    -c "SELECT 1 FROM public.schema_migrations WHERE migration_name = :'name'")"

  if [[ "$applied" == "1" ]]; then
    continue
  fi

  printf 'Applying migration %s...\n' "$migration_name"
  psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 -f "$migration"

  psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 \
    -v name="$migration_name" \
    -v checksum="$checksum" <<'SQL'
INSERT INTO public.schema_migrations (migration_name, checksum, applied_at)
VALUES (:'name', :'checksum', now())
ON CONFLICT (migration_name) DO UPDATE SET checksum = EXCLUDED.checksum;
SQL
done

psql -h "$POSTGRES_HOST" -U postgres -d dashboard -v ON_ERROR_STOP=1 -v app_password="$DASHBOARD_WEB_PASSWORD" <<'SQL'
GRANT SELECT ON public.schema_migrations TO dashboard_app;

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
