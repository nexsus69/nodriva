#!/bin/sh
set -eu

: "${REALTIME_DRAIN_URL:?REALTIME_DRAIN_URL must be set}"
: "${WORKFLOW_DRAIN_URL:?WORKFLOW_DRAIN_URL must be set}"
: "${REALTIME_WORKER_SECRET:?REALTIME_WORKER_SECRET must be set}"

interval="${REALTIME_WORKER_INTERVAL_SECONDS:-5}"
case "$interval" in
  ''|*[!0-9]*) echo "REALTIME_WORKER_INTERVAL_SECONDS must be a positive integer" >&2; exit 64 ;;
esac
if [ "$interval" -lt 1 ]; then
  echo "REALTIME_WORKER_INTERVAL_SECONDS must be at least 1" >&2
  exit 64
fi

drain() {
  component="$1"
  url="$2"
  if ! curl --fail --silent --show-error --output /dev/null --max-time 20 \
    -X POST \
    -H "Authorization: Bearer ${REALTIME_WORKER_SECRET}" \
    "$url"; then
    printf '{"timestamp":"%s","level":"error","component":"%s","message":"drain failed"}\n' "$(date -u +%FT%TZ)" "$component" >&2
  fi
}

while :; do
  drain 'realtime-worker' "$REALTIME_DRAIN_URL"
  drain 'workflow-worker' "$WORKFLOW_DRAIN_URL"
  sleep "$interval"
done
