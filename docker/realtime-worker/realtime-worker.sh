#!/bin/sh
set -eu

: "${REALTIME_WORKER_SECRET:?REALTIME_WORKER_SECRET must be set}"
if [ -z "${REALTIME_DRAIN_URL:-}" ] && [ -z "${WORKFLOW_DRAIN_URL:-}" ] && [ -z "${ATTACHMENT_CLEANUP_DRAIN_URL:-}" ]; then
  echo "at least one drain URL must be set" >&2
  exit 64
fi

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
  if [ -n "${REALTIME_DRAIN_URL:-}" ]; then drain 'realtime-worker' "$REALTIME_DRAIN_URL"; fi
  if [ -n "${WORKFLOW_DRAIN_URL:-}" ]; then drain 'workflow-worker' "$WORKFLOW_DRAIN_URL"; fi
  if [ -n "${ATTACHMENT_CLEANUP_DRAIN_URL:-}" ]; then drain 'attachment-cleanup-worker' "$ATTACHMENT_CLEANUP_DRAIN_URL"; fi
  if [ -n "${ACCOUNT_ACTION_DRAIN_URL:-}" ]; then
    drain 'account-action-worker' "$ACCOUNT_ACTION_DRAIN_URL"
  fi
  sleep "$interval"
done
