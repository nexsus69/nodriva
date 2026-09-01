#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${SCRIPT_DIR}/../var/backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STATUS_FILE="${BACKUP_STATUS_FILE:-${BACKUP_ROOT}/last-status.json}"

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { printf 'BACKUP_RETENTION_DAYS must be an integer\n' >&2; exit 2; }
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
exec 9>"$BACKUP_ROOT/.maintenance.lock"
flock -n 9 || { printf 'backup maintenance already running\n' >&2; exit 3; }
umask 077

schedule_enabled="$(psql -X -tA -v ON_ERROR_STOP=1 -d "${POSTGRES_DATABASE:-${PGDATABASE:-dashboard}}" -c "SELECT value_text FROM system_settings WHERE setting_key='backup.scheduledEnabled' AND deleted_at IS NULL" 2>/dev/null | tr -d '[:space:]' || true)"

write_status() {
  local status="$1" message="$2" backup_file="${3:-}" checksum_file="${4:-}"
  local escaped_message escaped_backup escaped_checksum
  escaped_message=$(printf '%s' "$message" | sed 's/[\\"]/[\\&]/g')
  escaped_backup=$(printf '%s' "$backup_file" | sed 's/[\\"]/[\\&]/g')
  escaped_checksum=$(printf '%s' "$checksum_file" | sed 's/[\\"]/[\\&]/g')
  printf '{"status":"%s","message":"%s","backupFile":"%s","checksumFile":"%s","completedAt":"%s"}\n' \
    "$status" "$escaped_message" "$escaped_backup" "$escaped_checksum" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATUS_FILE"
  chmod 600 "$STATUS_FILE"
}

if [[ "$schedule_enabled" == "false" ]]; then
  write_status paused "scheduled backup disabled by runtime policy"
  printf 'Scheduled backup is paused by runtime policy\n'
  exit 0
fi

backup_file="${BACKUP_ROOT}/dashboard_$(date -u +%Y%m%dT%H%M%SZ).dump"
checksum_file="${backup_file}.sha256"

on_error() {
  local code=$?
  write_status failed "backup maintenance failed with exit code ${code}" "$backup_file" "$checksum_file"
  exit "$code"
}
trap on_error ERR

"$SCRIPT_DIR/postgres-backup-verify.sh" backup-verify "$backup_file"
find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
write_status completed "backup and restore verification passed" "$backup_file" "$checksum_file"
printf 'Backup maintenance completed: %s\n' "$backup_file"
