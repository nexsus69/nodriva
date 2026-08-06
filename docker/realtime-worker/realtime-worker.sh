#!/bin/sh
set -eu

: "${REALTIME_DRAIN_URL:?REALTIME_DRAIN_URL must be set}"
: "${REALTIME_WORKER_SECRET:?REALTIME_WORKER_SECRET must be set}"

interval="${REALTIME_WORKER_INTERVAL_SECONDS:-5}"
case "$interval" in
  ''|*[!0-9]*) echo "REALTIME_WORKER_INTERVAL_SECONDS must be a positive integer" >&2; exit 64 ;;
esac
if [ "$interval" -lt 1 ]; then
  echo "REALTIME_WORKER_INTERVAL_SECONDS must be at least 1" >&2
  exit 64
fi

while :; do
  if ! curl --fail --silent --show-error --output /dev/null --max-time 20 \
    -X POST \
    -H "Authorization: Bearer ${REALTIME_WORKER_SECRET}" \
    "$REALTIME_DRAIN_URL"; then
    printf '{"timestamp":"%s","level":"error","component":"realtime-worker","message":"outbox drain failed"}\n' "$(date -u +%FT%TZ)" >&2
  fi
  sleep "$interval"
done
