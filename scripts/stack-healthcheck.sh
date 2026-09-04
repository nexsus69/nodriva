#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_ENV_FILE="${DASHBOARD_DEPLOY_ENV_FILE:-.env.docker}"
[[ -r "$DEPLOY_ENV_FILE" ]] || { printf 'ERROR: deployment environment file is not readable: %s\n' "$DEPLOY_ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$DEPLOY_ENV_FILE"
set +a

BASE_URL="${DASHBOARD_PUBLIC_URL:?DASHBOARD_PUBLIC_URL must be set}"
COMPOSE_PROJECT="${DASHBOARD_COMPOSE_PROJECT:-dashboard_ultimate}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-93600}"
OPTIONAL_INTEGRATIONS="${DASHBOARD_COMPOSE_INTEGRATIONS:-}"
CORE_SERVICES=(postgres web proxy)

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command docker
require_command curl
require_command date
[[ "$BACKUP_MAX_AGE_SECONDS" =~ ^[0-9]+$ ]] || fail 'BACKUP_MAX_AGE_SECONDS must be an integer'

integration_enabled() {
  local integration="$1"
  [[ ",${OPTIONAL_INTEGRATIONS// /}," == *",${integration},"* ]]
}

container_id_for() {
  local service="$1"
  docker ps \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=${service}" \
    --filter status=running \
    --format '{{.ID}}' | head -n 1
}

check_service() {
  local service="$1"
  local container_id health
  container_id="$(container_id_for "$service")"
  [[ -n "$container_id" ]] || fail "compose service is not running: $service"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container_id")"
  case "$health" in
    healthy|running) printf '  %-16s %s\n' "$service" "$health" ;;
    *) fail "compose service is not healthy: $service ($health)" ;;
  esac
}

printf 'Checking application endpoint: %s/login\n' "$BASE_URL"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/login" >/dev/null

printf 'Checking compose services\n'
for service in "${CORE_SERVICES[@]}"; do
  check_service "$service"
done

if integration_enabled realtime; then
  check_service soketi
  check_service realtime-worker
fi
if integration_enabled antivirus; then
  check_service clamav
fi
if integration_enabled backup; then
  check_service backup
fi
if integration_enabled monitoring; then
  check_service prometheus
fi

postgres_id="$(container_id_for postgres)"
docker exec "$postgres_id" pg_isready -p "${DASHBOARD_POSTGRES_PORT:?DASHBOARD_POSTGRES_PORT must be set}" -U postgres -d dashboard >/dev/null \
  || fail 'PostgreSQL is not accepting connections'

if integration_enabled backup; then
  backup_id="$(container_id_for backup)"
  backup_status="$(docker exec "$backup_id" sh -c 'cat /backups/postgres/last-status.json' 2>/dev/null)" \
    || fail 'verified backup status is unavailable'
  [[ "$backup_status" == *'"status":"completed"'* ]] || fail 'latest backup verification did not complete successfully'
  backup_completed_at="$(printf '%s' "$backup_status" | sed -n 's/.*"completedAt":"\([^"]*\)".*/\1/p')"
  [[ -n "$backup_completed_at" ]] || fail 'latest backup completion time is unavailable'
  backup_completed_epoch="$(date -u -d "$backup_completed_at" +%s 2>/dev/null)" \
    || fail 'latest backup completion time is invalid'
  backup_age_seconds="$(( $(date -u +%s) - backup_completed_epoch ))"
  (( backup_age_seconds >= 0 && backup_age_seconds <= BACKUP_MAX_AGE_SECONDS )) \
    || fail "latest verified backup is too old (${backup_age_seconds}s)"
  printf '  %-16s %s (%ss old)\n' 'backup-restore' 'verified' "$backup_age_seconds"
fi

if integration_enabled monitoring; then
  prometheus_id="$(container_id_for prometheus)"
  docker exec "$prometheus_id" wget -q -O- "http://${CONTAINER_LOOPBACK_HOST:?CONTAINER_LOOPBACK_HOST must be set}:${PROMETHEUS_PORT:?PROMETHEUS_PORT must be set}/-/ready" >/dev/null \
    || fail 'Prometheus is not ready'
  prometheus_targets="$(docker exec "$prometheus_id" wget -q -O- "http://${CONTAINER_LOOPBACK_HOST:?CONTAINER_LOOPBACK_HOST must be set}:${PROMETHEUS_PORT:?PROMETHEUS_PORT must be set}/api/v1/targets")" \
    || fail 'Prometheus targets cannot be queried'
  [[ "$prometheus_targets" == *'"health":"up"'* && "$prometheus_targets" != *'"health":"down"'* ]] \
    || fail 'Prometheus has no healthy scrape target or reports a down target'
  printf '  %-16s %s\n' 'observability' 'ready'
fi

printf 'Stack healthcheck passed\n'
