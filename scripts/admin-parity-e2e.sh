#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
postgres_container="${PARITY_POSTGRES_CONTAINER:-nodriva-postgres-1}"
web_container="${PARITY_WEB_CONTAINER:-nodriva-web-1}"
test_database="dashboard_admin_e2e_test"
template_database="${PARITY_POSTGRES_TEMPLATE_DATABASE:-dashboard_test}"
sqlite_path="$(mktemp /tmp/dashboard-admin-parity-XXXXXX.sqlite)"
sqlite_attachments="$(mktemp -d /tmp/dashboard-admin-parity-sqlite-attachments-XXXXXX)"
postgres_attachments="$(mktemp -d /tmp/dashboard-admin-parity-postgres-attachments-XXXXXX)"
sqlite_log="$(mktemp /tmp/dashboard-admin-parity-sqlite-XXXXXX.log)"
postgres_log="$(mktemp /tmp/dashboard-admin-parity-postgres-XXXXXX.log)"
realtime_enabled="${PARITY_REALTIME_ENABLED:-false}"
session_idle_timeout_seconds="${PARITY_SESSION_IDLE_TIMEOUT_SECONDS:-1800}"
sqlite_pid=""
postgres_pid=""
realtime_container=""
realtime_port=""
realtime_environment=()
realtime_worker_secret="dashboard-admin-parity-realtime-worker-secret"

# CI can supply two explicit PostgreSQL URLs instead of local Docker container
# names. The admin URL is used only to create/drop the isolated E2E database;
# the application URL must use the restricted database role.
uses_connection_urls=false
postgres_server_url=""

drop_test_database() {
  if [[ "${uses_connection_urls}" == true ]]; then
    psql "${postgres_server_url}" -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS ${test_database} WITH (FORCE)" >/dev/null
  else
    docker exec "${postgres_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS ${test_database} WITH (FORCE)" >/dev/null
  fi
}

create_test_database() {
  if [[ "${uses_connection_urls}" == true ]]; then
    psql "${postgres_server_url}" -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${test_database} TEMPLATE ${template_database}" >/dev/null
  else
    docker exec "${postgres_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${test_database} TEMPLATE ${template_database}" >/dev/null
  fi
}

# The reusable template can legitimately lag behind an additive migration.
# Reapply idempotent migrations only to the freshly created, isolated test DB
# before fixtures start; never mutate the template or an operational database.
upgrade_test_database() {
  for migration in "${workspace_dir}"/db/migrations/*.sql; do
    if [[ "${uses_connection_urls}" == true ]]; then
      psql "${postgres_admin_url}" -X -v ON_ERROR_STOP=1 -f "${migration}" >/dev/null
    else
      docker exec -i "${postgres_container}" psql -U postgres -d "${test_database}" -X -v ON_ERROR_STOP=1 <"${migration}" >/dev/null
    fi
  done
}

cleanup() {
  if [[ -n "${sqlite_pid}" ]]; then kill "${sqlite_pid}" 2>/dev/null || true; fi
  if [[ -n "${postgres_pid}" ]]; then kill "${postgres_pid}" 2>/dev/null || true; fi
  wait "${sqlite_pid}" 2>/dev/null || true
  wait "${postgres_pid}" 2>/dev/null || true
  if [[ -n "${realtime_container}" ]]; then docker rm -f "${realtime_container}" >/dev/null 2>&1 || true; fi
  drop_test_database || true
  rm -f "${sqlite_path}"
  rm -rf "${sqlite_attachments}" "${postgres_attachments}"
  if [[ "${PARITY_KEEP_LOGS:-false}" == true ]]; then
    echo "Log SQLite: ${sqlite_log}" >&2
    echo "Log PostgreSQL: ${postgres_log}" >&2
  else
    rm -f "${sqlite_log}" "${postgres_log}"
  fi
}
trap cleanup EXIT INT TERM

cd "${workspace_dir}"

if [[ -n "${PARITY_POSTGRES_ADMIN_URL:-}" || -n "${PARITY_POSTGRES_APP_URL:-}" ]]; then
  : "${PARITY_POSTGRES_ADMIN_URL:?PARITY_POSTGRES_ADMIN_URL is required when configuring PostgreSQL URLs}"
  : "${PARITY_POSTGRES_APP_URL:?PARITY_POSTGRES_APP_URL is required when configuring PostgreSQL URLs}"
  uses_connection_urls=true
  postgres_server_url="${PARITY_POSTGRES_ADMIN_URL%/*}/postgres"
  production_app_url="${PARITY_POSTGRES_APP_URL}"
  postgres_admin_url="${PARITY_POSTGRES_ADMIN_URL%/*}/${test_database}"
else
  postgres_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${postgres_container}")"
  postgres_password="$(docker exec "${postgres_container}" printenv POSTGRES_PASSWORD)"
  if production_app_url="$(docker exec "${web_container}" printenv DATABASE_URL 2>/dev/null)"; then
    production_app_url="${production_app_url/@postgres:/@${postgres_ip}:}"
    postgres_admin_url="postgresql://postgres:${postgres_password}@${postgres_ip}:5432/${test_database}"
  else
    # The production runtime derives DATABASE_URL in its entrypoint so the
    # database password is never retained in the container environment.
    # Reconstruct the isolated test URL from the same inputs without logging
    # any credential, preserving compatibility with the older direct-URL form.
    dashboard_web_password="$(docker exec "${web_container}" printenv DASHBOARD_WEB_PASSWORD)"
    encoded_dashboard_web_password="$(DASHBOARD_WEB_PASSWORD="${dashboard_web_password}" node -p 'encodeURIComponent(process.env.DASHBOARD_WEB_PASSWORD)')"
    encoded_postgres_password="$(POSTGRES_PASSWORD="${postgres_password}" node -p 'encodeURIComponent(process.env.POSTGRES_PASSWORD)')"
    postgres_port="$(docker exec "${web_container}" printenv DASHBOARD_POSTGRES_PORT)"
    production_app_url="postgresql://dashboard_web:${encoded_dashboard_web_password}@${postgres_ip}:${postgres_port}/dashboard"
    postgres_admin_url="postgresql://postgres:${encoded_postgres_password}@${postgres_ip}:${postgres_port}/${test_database}"
  fi
fi
postgres_app_url="${production_app_url%/*}/${test_database}"

drop_test_database
create_test_database
upgrade_test_database

if [[ "${realtime_enabled}" == true ]]; then
  # The browser and both local Next.js processes share this isolated broker.
  # It prevents the realtime E2E profile from depending on deployment Soketi.
  realtime_container="dashboard-admin-parity-soketi-$$"
  realtime_container="$(docker run --detach --rm --name "${realtime_container}" \
    --publish 127.0.0.1::6001 \
    --env SOKETI_DEFAULT_APP_ID=dashboard-admin-parity \
    --env SOKETI_DEFAULT_APP_KEY=dashboard-admin-parity-key \
    --env SOKETI_DEFAULT_APP_SECRET=dashboard-admin-parity-secret \
    --env SOKETI_DEFAULT_APP_CLUSTER=mt1 \
    --env SOKETI_PORT=6001 \
    quay.io/soketi/soketi:1.6-16-alpine)"
  realtime_port="$(docker port "${realtime_container}" 6001/tcp | awk -F: 'NR == 1 { print $NF }')"
  if [[ -z "${realtime_port}" ]]; then
    echo "Unable to determine the isolated realtime test port." >&2
    exit 1
  fi
  realtime_environment=(
    NEXT_PUBLIC_PUSHER_KEY=dashboard-admin-parity-key
    NEXT_PUBLIC_PUSHER_CLUSTER=mt1
    NEXT_PUBLIC_PUSHER_HOST=127.0.0.1
    NEXT_PUBLIC_PUSHER_PORT="${realtime_port}"
    NEXT_PUBLIC_PUSHER_SCHEME=http
    PUSHER_APP_ID=dashboard-admin-parity
    PUSHER_SECRET=dashboard-admin-parity-secret
    REALTIME_INTERNAL_HOST=127.0.0.1
    REALTIME_INTERNAL_PORT="${realtime_port}"
    REALTIME_INTERNAL_SCHEME=http
    REALTIME_WORKER_SECRET="${realtime_worker_secret}"
  )
  realtime_ready=false
  for _ in $(seq 1 30); do
    if curl --fail --silent "http://127.0.0.1:${realtime_port}/ready" >/dev/null; then
      realtime_ready=true
      break
    fi
    sleep 1
  done
  if [[ "${realtime_ready}" != true ]]; then
    echo "Isolated realtime test broker is unavailable." >&2
    docker logs "${realtime_container}" >&2 || true
    exit 1
  fi
fi

if [[ "${PARITY_SKIP_BUILD:-false}" != true ]]; then
  pnpm --filter @dashboard/core build
  env "${realtime_environment[@]}" \
    NEXT_PUBLIC_REALTIME_ENABLED="${realtime_enabled}" \
    NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS="${session_idle_timeout_seconds}" \
    pnpm --filter @dashboard/web build
fi

admin_email="admin-parity@dashboard.test"
admin_password="Parity-admin-2026!"
PARITY_SQLITE_PATH="${sqlite_path}" \
PARITY_POSTGRES_ADMIN_URL="${postgres_admin_url}" \
PARITY_ADMIN_EMAIL="${admin_email}" \
PARITY_ADMIN_PASSWORD="${admin_password}" \
node scripts/admin-parity-fixtures.mjs

common_secret="admin-parity-nextauth-secret-2026-at-least-32-characters"
env "${realtime_environment[@]}" \
DATABASE_ADAPTER=sqlite \
SQLITE_DATABASE_PATH="${sqlite_path}" \
NEXTAUTH_SECRET="${common_secret}" \
NEXTAUTH_URL="http://127.0.0.1:3101" \
ACCOUNT_ACTION_PUBLIC_BASE_URL="http://127.0.0.1:3101" \
NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS="${session_idle_timeout_seconds}" \
NEXT_PUBLIC_REALTIME_ENABLED="${realtime_enabled}" \
ATTACHMENTS_ROOT="${sqlite_attachments}" \
pnpm --filter @dashboard/web exec next start -p 3101 >"${sqlite_log}" 2>&1 &
sqlite_pid="$!"

env "${realtime_environment[@]}" \
DATABASE_ADAPTER=postgres \
DATABASE_URL="${postgres_app_url}" \
NEXTAUTH_SECRET="${common_secret}" \
NEXTAUTH_URL="http://127.0.0.1:3102" \
ACCOUNT_ACTION_PUBLIC_BASE_URL="http://127.0.0.1:3102" \
NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS="${session_idle_timeout_seconds}" \
NEXT_PUBLIC_REALTIME_ENABLED="${realtime_enabled}" \
ATTACHMENTS_ROOT="${postgres_attachments}" \
pnpm --filter @dashboard/web exec next start -p 3102 >"${postgres_log}" 2>&1 &
postgres_pid="$!"

for port in 3101 3102; do
  ready=false
  for _ in $(seq 1 60); do
    if curl --fail --silent "http://127.0.0.1:${port}/login" >/dev/null; then
      ready=true
      break
    fi
    sleep 1
  done
  if [[ "${ready}" != true ]]; then
    echo "Server E2E sulla porta ${port} non disponibile." >&2
    tail -80 "${sqlite_log}" >&2 || true
    tail -80 "${postgres_log}" >&2 || true
    exit 1
  fi
done

if [[ -z "${CHROME_BIN:-}" ]]; then
  unset CHROME_BIN
fi

# Exposed only to the Playwright process. The URL targets the isolated
# dashboard_admin_e2e_test database created above and lets diagnostic E2E
# assertions distinguish an HTTP/UI projection problem from persistence.
E2E_RUN=true \
REALTIME_WORKER_SECRET="${realtime_worker_secret}" \
E2E_REALTIME_RUN="${realtime_enabled}" \
E2E_BASE_URL="http://127.0.0.1:3102" \
E2E_EMAIL="${admin_email}" \
E2E_PASSWORD="${admin_password}" \
E2E_USER_ID="00000000-0000-0000-0000-000000000001" \
E2E_SQLITE_DATABASE_PATH="${sqlite_path}" \
E2E_ADMIN_PARITY_RUN=true \
E2E_SQLITE_BASE_URL="http://127.0.0.1:3101" \
E2E_POSTGRES_BASE_URL="http://127.0.0.1:3102" \
E2E_POSTGRES_DATABASE_URL="${postgres_admin_url}" \
E2E_ADMIN_EMAIL="${admin_email}" \
E2E_ADMIN_PASSWORD="${admin_password}" \
bash -c 'read -r -a specs <<< "${PARITY_E2E_SPECS:-e2e/admin-adapter-parity.spec.ts}"; exec pnpm exec playwright test --workers=1 "${specs[@]}"'
