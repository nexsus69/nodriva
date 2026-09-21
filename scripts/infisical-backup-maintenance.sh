#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${INFISICAL_BACKUP_ROOT:-/backups/infisical}"
RETENTION_DAYS="${INFISICAL_BACKUP_RETENTION_DAYS:-30}"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { printf 'INFISICAL_BACKUP_RETENTION_DAYS must be an integer\n' >&2; exit 2; }
mkdir -p "$BACKUP_ROOT"; chmod 700 "$BACKUP_ROOT"; umask 077
exec 9>"$BACKUP_ROOT/.maintenance.lock"; flock -n 9 || { printf 'Infisical backup maintenance already running\n' >&2; exit 3; }
backup_file="$BACKUP_ROOT/infisical_$(date -u +%Y%m%dT%H%M%SZ).dump"
"$SCRIPT_DIR/infisical-backup-verify.sh" backup-verify "$backup_file"
find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
printf 'Infisical backup maintenance completed: %s\n' "$backup_file"
