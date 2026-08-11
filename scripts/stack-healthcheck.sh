#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${DASHBOARD_BASE_URL:-http://127.0.0.1:3001}"
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

printf 'Checking application endpoint: %s/login\n' "$BASE_URL"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/login" >/dev/null

printf 'Checking compose services\n'
for service in "${SERVICES[@]}"; do
  container_id="$(docker ps --filter "label=com.docker.compose.service=${service}" --filter status=running --format '{{.ID}}' | head -n 1)"
  [[ -n "$container_id" ]] || fail "compose service is not running: $service"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container_id")"
  case "$health" in
    healthy|running) printf '  %-16s %s\n' "$service" "$health" ;;
    *) fail "compose service is not healthy: $service ($health)" ;;
  esac
done

postgres_id="$(docker ps --filter 'label=com.docker.compose.service=postgres' --filter status=running --format '{{.ID}}' | head -n 1)"
docker exec "$postgres_id" pg_isready -U postgres -d dashboard >/dev/null \
  || fail 'PostgreSQL is not accepting connections'

printf 'Stack healthcheck passed\n'
