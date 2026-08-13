#!/usr/bin/env bash
set -Eeuo pipefail

: "${INTEGRATION_DATABASE_ADMIN_URL:?INTEGRATION_DATABASE_ADMIN_URL must be set}"
: "${INTEGRATION_DATABASE_URL:?INTEGRATION_DATABASE_URL must be set}"
: "${INTEGRATION_DATABASE_APP_PASSWORD:?INTEGRATION_DATABASE_APP_PASSWORD must be set}"

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_role="${INTEGRATION_DATABASE_APP_ROLE:-dashboard_ci_app}"

if [[ ! "${app_role}" =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "Invalid integration database role name." >&2
  exit 1
fi

database_name="$(psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
if [[ ! "${database_name}" =~ (^|_)test(_|$) ]]; then
  echo "Refusing to initialize non-test database '${database_name}'." >&2
  exit 1
fi

psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 \
  -f "${workspace_dir}/Specifiche/dashboard_v4_schema_corrected.sql"

for migration in "${workspace_dir}"/db/migrations/*.sql; do
  psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 -f "${migration}"
done

psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 \
  -v app_role="${app_role}" \
  -v app_password="${INTEGRATION_DATABASE_APP_PASSWORD}" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_role',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'app_role', :'app_password')\gexec
SELECT format('GRANT dashboard_app TO %I', :'app_role')\gexec
SQL

effective_role="$(psql "${INTEGRATION_DATABASE_URL}" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_user')"
if [[ "${effective_role}" != "${app_role}" ]]; then
  echo "Integration URL uses '${effective_role}', expected '${app_role}'." >&2
  exit 1
fi

restricted="$(psql "${INTEGRATION_DATABASE_URL}" -X -A -t -v ON_ERROR_STOP=1 -c \
  "SELECT NOT role.rolsuper
      AND pg_has_role(current_user, 'dashboard_app', 'member')
      AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
      AND NOT has_table_privilege(current_user, 'audit_logs', 'UPDATE')
      AND NOT has_table_privilege(current_user, 'audit_logs', 'DELETE')
      AND NOT has_table_privilege(current_user, 'audit_logs', 'TRUNCATE')
   FROM pg_roles role
   WHERE role.rolname = current_user")"
if [[ "${restricted}" != "t" ]]; then
  echo "The integration login does not satisfy the restricted application-role policy." >&2
  exit 1
fi

printf 'PostgreSQL test schema, migrations and restricted application role are ready.\n'
