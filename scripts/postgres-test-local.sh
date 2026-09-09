#!/usr/bin/env bash
set -Eeuo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${workspace_dir}/docker-compose.postgres-test.yml"
compose=(docker compose --project-name nodriva-postgres-test -f "${compose_file}")

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null
}
trap cleanup EXIT INT TERM

"${compose[@]}" down --volumes --remove-orphans >/dev/null
"${compose[@]}" up -d postgres-test
"${compose[@]}" --profile bootstrap run --rm bootstrap

export INTEGRATION_DATABASE_ADMIN_URL='postgresql://postgres:dashboard-ci-admin@127.0.0.1:55432/dashboard_ci_test'
export INTEGRATION_DATABASE_URL='postgresql://dashboard_ci_app:dashboard-ci-app@127.0.0.1:55432/dashboard_ci_test'
export INTEGRATION_DATABASE_APP_PASSWORD='dashboard-ci-app'
export DATABASE_URL="${INTEGRATION_DATABASE_URL}"
export DATABASE_ADAPTER=postgres
export REQUIRE_RESTRICTED_DB_ROLE=true

cd "${workspace_dir}"
pnpm test:postgres

# Optional additional checks share this isolated database before teardown.
if [[ $# -gt 0 ]]; then "$@"; fi
