#!/usr/bin/env bash
set -Eeuo pipefail

: "${INTEGRATION_DATABASE_ADMIN_URL:?INTEGRATION_DATABASE_ADMIN_URL must be set}"
: "${INTEGRATION_DATABASE_URL:?INTEGRATION_DATABASE_URL must be set}"
: "${INTEGRATION_DATABASE_APP_PASSWORD:?INTEGRATION_DATABASE_APP_PASSWORD must be set}"

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_role="${INTEGRATION_DATABASE_APP_ROLE:-dashboard_ci_app}"
legacy_user_id="00000000-0000-4000-8000-000000000901"
legacy_session_id="00000000-0000-4000-8000-000000000902"
legacy_session_token="dashboard-migration-upgrade-test-token"

if [[ ! "${app_role}" =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "Invalid integration database role name." >&2
  exit 1
fi

database_name="$(psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
if [[ ! "${database_name}" =~ (^|_)test(_|$) ]]; then
  echo "Refusing to initialize non-test database '${database_name}'." >&2
  exit 1
fi

existing_tables="$(psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -A -t -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');")"
if [[ "${existing_tables}" != "0" ]]; then
  echo "Refusing to initialize non-empty test database '${database_name}'." >&2
  exit 1
fi

psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 \
  -f "${workspace_dir}/db/schema/001_baseline_schema.sql"

for migration in "${workspace_dir}"/db/migrations/*.sql; do
  if [[ "$(basename "${migration}")" == 009_* ]]; then
    psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 \
      -v legacy_user_id="${legacy_user_id}" \
      -v legacy_session_id="${legacy_session_id}" \
      -v legacy_session_token="${legacy_session_token}" <<'SQL'
INSERT INTO users (id, email, password_hash)
VALUES (:'legacy_user_id', 'migration-upgrade@dashboard.test', 'not-a-runtime-password');

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NULL
);

INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_used_at)
VALUES (
  :'legacy_session_id',
  :'legacy_user_id',
  :'legacy_session_token',
  now() + interval '1 hour',
  now() - interval '5 minutes',
  now()
);
SQL
  fi
  psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 -f "${migration}"
done

upgrade_fixture_valid="$(psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -A -t -v ON_ERROR_STOP=1 \
  -v legacy_session_id="${legacy_session_id}" \
  -v legacy_session_token="${legacy_session_token}" <<'SQL'
SELECT to_regclass('public.sessions') IS NULL
      AND EXISTS (
        SELECT 1
        FROM user_sessions
        WHERE id = :'legacy_session_id'
          AND session_token_hash = encode(digest(:'legacy_session_token', 'sha256'), 'hex')
          AND status = 'active'
      );
SQL
)"
if [[ "${upgrade_fixture_valid}" != "t" ]]; then
  echo "Legacy session upgrade verification failed." >&2
  exit 1
fi

psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 \
  -v legacy_user_id="${legacy_user_id}" >/dev/null <<'SQL'
DELETE FROM users WHERE id = :'legacy_user_id';
SQL

for migration in "${workspace_dir}"/db/migrations/*.sql; do
  psql "${INTEGRATION_DATABASE_ADMIN_URL}" -X -v ON_ERROR_STOP=1 -f "${migration}" >/dev/null
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

printf 'PostgreSQL empty-schema bootstrap, legacy upgrade, migration reapply and restricted application role are ready.\n'
