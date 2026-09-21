#!/usr/bin/env bash
set -Eeuo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${workspace_dir}/docker-compose.full.yml"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command docker
require_command diff

# Deliberately model the minimal deployment: optional integration variables
# must not be needed merely to render the base Compose profile.
unset NEXT_PUBLIC_REALTIME_ENABLED NEXT_PUBLIC_PUSHER_KEY NEXT_PUBLIC_PUSHER_CLUSTER
unset NEXT_PUBLIC_PUSHER_HOST NEXT_PUBLIC_PUSHER_PORT NEXT_PUBLIC_PUSHER_SCHEME
unset PUSHER_APP_ID PUSHER_SECRET REALTIME_WORKER_SECRET REALTIME_INTERNAL_HOST
unset REALTIME_INTERNAL_PORT REALTIME_INTERNAL_SCHEME CLAMAV_HOST CLAMAV_PORT
unset ATTACHMENTS_REQUIRE_SCAN BACKUP_ROOT BACKUP_STATUS_FILE

export POSTGRES_PASSWORD='compose-contract-postgres'
export DASHBOARD_WEB_PASSWORD='compose-contract/with+reserved%chars@='
export SEED_ADMIN_PASSWORD='compose-contract-admin'
export SEED_ADMIN_EMAIL='admin@compose-contract.test'
export NEXTAUTH_SECRET='compose-contract-nextauth-secret-at-least-32-characters'
export DASHBOARD_PUBLIC_URL='https://dashboard.contract.test'
export DASHBOARD_PUBLIC_HOST='dashboard.contract.test'
export DASHBOARD_BIND_ADDRESS='127.0.0.1'
export DASHBOARD_METRICS_BIND_ADDRESS='127.0.0.1'
export DASHBOARD_WEB_BIND_ADDRESS='0.0.0.0'
export DASHBOARD_POSTGRES_PORT='55432'
export DASHBOARD_POSTGRES_HOST='postgres'
export DASHBOARD_WEB_PORT='13000'
export DASHBOARD_WEB_INTERNAL_HOST='web'
export DASHBOARD_WEB_INTERNAL_SCHEME='http'
export DASHBOARD_HTTP_PORT='18080'
export DASHBOARD_HTTPS_PORT='18443'
export PROMETHEUS_PORT='19090'
export CONTAINER_LOOPBACK_HOST='localhost'
export ATTACHMENTS_ENCRYPTION_KEY='1111111111111111111111111111111111111111111111111111111111111111'
export FIELD_ENCRYPTION_KEY='2222222222222222222222222222222222222222222222222222222222222222'
export MFA_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

base_services=$(
  docker compose -f "$compose_file" config -q
  docker compose -f "$compose_file" config --services | sort
)
expected_base=$'db-migrate\ndb-seed\npostgres\nproxy\nweb'
diff -u <(printf '%s\n' "$expected_base") <(printf '%s\n' "$base_services")

web_block="$(awk '/^  web:$/,/^  realtime-worker:/' "$compose_file")"
if printf '%s\n' "$web_block" | grep -Eq '^[[:space:]]+(soketi|clamav):'; then
  fail 'web must not depend on an optional Compose service'
fi

export NEXT_PUBLIC_REALTIME_ENABLED='true'
export NEXT_PUBLIC_PUSHER_KEY='compose-contract-public-key'
export NEXT_PUBLIC_PUSHER_CLUSTER='mt1'
export NEXT_PUBLIC_PUSHER_HOST='realtime.contract.test'
export NEXT_PUBLIC_PUSHER_PORT='443'
export NEXT_PUBLIC_PUSHER_SCHEME='https'
export PUSHER_APP_ID='compose-contract'
export PUSHER_SECRET='compose-contract-pusher-secret'
export REALTIME_WORKER_SECRET='compose-contract-worker-secret'
export REALTIME_INTERNAL_HOST='soketi'
export REALTIME_INTERNAL_PORT='6001'
export REALTIME_INTERNAL_SCHEME='http'
export SOKETI_HOST='soketi'
export SOKETI_PORT='6001'
export CLAMAV_HOST='clamav'
export CLAMAV_PORT='3310'
export ATTACHMENTS_REQUIRE_SCAN='true'
export BACKUP_ROOT='/backups/postgres'
export BACKUP_STATUS_FILE='/backups/postgres/last-status.json'

for overlay in realtime antivirus monitoring backup; do
  docker compose -f "$compose_file" -f "${workspace_dir}/docker-compose.${overlay}.yml" config -q
done

full_services=$(
  docker compose -f "$compose_file" \
    -f "${workspace_dir}/docker-compose.realtime.yml" \
    -f "${workspace_dir}/docker-compose.antivirus.yml" \
    -f "${workspace_dir}/docker-compose.monitoring.yml" \
    -f "${workspace_dir}/docker-compose.backup.yml" config -q
  docker compose -f "$compose_file" \
    -f "${workspace_dir}/docker-compose.realtime.yml" \
    -f "${workspace_dir}/docker-compose.antivirus.yml" \
    -f "${workspace_dir}/docker-compose.monitoring.yml" \
    -f "${workspace_dir}/docker-compose.backup.yml" config --services | sort
)
expected_full=$'backup\nclamav\ndb-migrate\ndb-seed\npostgres\nprometheus\nproxy\nrealtime-worker\nsoketi\nweb'
diff -u <(printf '%s\n' "$expected_full") <(printf '%s\n' "$full_services")

printf 'Docker Compose profile contract passed\n'
