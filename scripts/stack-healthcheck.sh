#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${DASHBOARD_BASE_URL:-http://127.0.0.1:3001}"
COMPOSE_PROJECT="${DASHBOARD_COMPOSE_PROJECT:-dashboard_ultimate}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-93600}"
SERVICES=(postgres web soketi clamav proxy realtime-worker backup prometheus)

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

printf 'Checking application endpoint: %s/login\n' "$BASE_URL"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/login" >/dev/null

printf 'Checking compose services\n'
for service in "${SERVICES[@]}"; do
  container_id="$(docker ps \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=${service}" \
    --filter status=running \
    --format '{{.ID}}' | head -n 1)"
  [[ -n "$container_id" ]] || fail "compose service is not running: $service"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container_id")"
  case "$health" in
    healthy|running) printf '  %-16s %s\n' "$service" "$health" ;;
    *) fail "compose service is not healthy: $service ($health)" ;;
  esac
done

postgres_id="$(docker ps \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --filter 'label=com.docker.compose.service=postgres' \
  --filter status=running \
  --format '{{.ID}}' | head -n 1)"
docker exec "$postgres_id" pg_isready -U postgres -d dashboard >/dev/null \
  || fail 'PostgreSQL is not accepting connections'

backup_id="$(docker ps \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --filter 'label=com.docker.compose.service=backup' \
  --filter status=running \
  --format '{{.ID}}' | head -n 1)"
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

prometheus_id="$(docker ps \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --filter 'label=com.docker.compose.service=prometheus' \
  --filter status=running \
  --format '{{.ID}}' | head -n 1)"
docker exec "$prometheus_id" wget -q -O- http://127.0.0.1:9090/-/ready >/dev/null \
  || fail 'Prometheus is not ready'
prometheus_targets="$(docker exec "$prometheus_id" wget -q -O- http://127.0.0.1:9090/api/v1/targets)" \
  || fail 'Prometheus targets cannot be queried'
[[ "$prometheus_targets" == *'"health":"up"'* && "$prometheus_targets" != *'"health":"down"'* ]] \
  || fail 'Prometheus has no healthy scrape target or reports a down target'
printf '  %-16s %s\n' 'observability' 'ready'

printf 'Stack healthcheck passed\n'
