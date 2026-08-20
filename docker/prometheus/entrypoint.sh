#!/bin/sh
set -eu

: "${REALTIME_WORKER_SECRET:?REALTIME_WORKER_SECRET must be set}"
: "${REALTIME_METRICS_TARGET:?REALTIME_METRICS_TARGET must be set}"
: "${PROMETHEUS_RETENTION_TIME:=30d}"

sed \
  -e "s|__REALTIME_WORKER_SECRET__|${REALTIME_WORKER_SECRET}|g" \
  -e "s|__REALTIME_METRICS_TARGET__|${REALTIME_METRICS_TARGET}|g" \
  /etc/prometheus/prometheus.yml.template > /etc/prometheus/prometheus.yml

exec /bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time="${PROMETHEUS_RETENTION_TIME}"
