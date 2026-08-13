#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
postgres_container="${PARITY_POSTGRES_CONTAINER:-dashboard_ultimate-postgres-1}"
web_container="${PARITY_WEB_CONTAINER:-dashboard_ultimate-web-1}"
test_database="dashboard_admin_e2e_test"
sqlite_path="$(mktemp /tmp/dashboard-admin-parity-XXXXXX.sqlite)"
sqlite_attachments="$(mktemp -d /tmp/dashboard-admin-parity-sqlite-attachments-XXXXXX)"
postgres_attachments="$(mktemp -d /tmp/dashboard-admin-parity-postgres-attachments-XXXXXX)"
sqlite_log="$(mktemp /tmp/dashboard-admin-parity-sqlite-XXXXXX.log)"
postgres_log="$(mktemp /tmp/dashboard-admin-parity-postgres-XXXXXX.log)"
sqlite_pid=""
postgres_pid=""

cleanup() {
  if [[ -n "${sqlite_pid}" ]]; then kill "${sqlite_pid}" 2>/dev/null || true; fi
  if [[ -n "${postgres_pid}" ]]; then kill "${postgres_pid}" 2>/dev/null || true; fi
  wait "${sqlite_pid}" 2>/dev/null || true
  wait "${postgres_pid}" 2>/dev/null || true
  docker exec "${postgres_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${test_database} WITH (FORCE)" >/dev/null || true
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

postgres_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${postgres_container}")"
postgres_password="$(docker exec "${postgres_container}" printenv POSTGRES_PASSWORD)"
production_app_url="$(docker exec "${web_container}" printenv DATABASE_URL)"
host_app_url="${production_app_url/@postgres:/@${postgres_ip}:}"
postgres_app_url="${host_app_url%/*}/${test_database}"
postgres_admin_url="postgresql://postgres:${postgres_password}@${postgres_ip}:5432/${test_database}"

docker exec "${postgres_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${test_database} WITH (FORCE)" >/dev/null
docker exec "${postgres_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE ${test_database} TEMPLATE dashboard_test" >/dev/null

if [[ "${PARITY_SKIP_BUILD:-false}" != true ]]; then
  pnpm --filter @dashboard/core build
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
DATABASE_ADAPTER=sqlite \
SQLITE_DATABASE_PATH="${sqlite_path}" \
NEXTAUTH_SECRET="${common_secret}" \
NEXTAUTH_URL="http://127.0.0.1:3101" \
ACCOUNT_ACTION_PUBLIC_BASE_URL="http://127.0.0.1:3101" \
NEXT_PUBLIC_REALTIME_ENABLED=false \
ATTACHMENTS_ROOT="${sqlite_attachments}" \
pnpm --filter @dashboard/web exec next start -p 3101 >"${sqlite_log}" 2>&1 &
sqlite_pid="$!"

DATABASE_URL="${postgres_app_url}" \
NEXTAUTH_SECRET="${common_secret}" \
NEXTAUTH_URL="http://127.0.0.1:3102" \
ACCOUNT_ACTION_PUBLIC_BASE_URL="http://127.0.0.1:3102" \
NEXT_PUBLIC_REALTIME_ENABLED=false \
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

E2E_ADMIN_PARITY_RUN=true \
E2E_SQLITE_BASE_URL="http://127.0.0.1:3101" \
E2E_POSTGRES_BASE_URL="http://127.0.0.1:3102" \
E2E_ADMIN_EMAIL="${admin_email}" \
E2E_ADMIN_PASSWORD="${admin_password}" \
CHROME_BIN="${CHROME_BIN:-/usr/bin/google-chrome}" \
pnpm exec playwright test e2e/admin-adapter-parity.spec.ts
