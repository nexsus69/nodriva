#!/usr/bin/env bash
set -Eeuo pipefail

# Creates a custom PostgreSQL archive for self-hosted Infisical and restores it
# only into a disposable database. The master encryption key is deliberately
# never copied into this archive.
CONTAINER_NAME="${INFISICAL_POSTGRES_CONTAINER:-nodriva-infisical-infisical-db-1}"
SOURCE_DATABASE="${INFISICAL_DATABASE:-infisical}"
POSTGRES_USER_NAME="${INFISICAL_POSTGRES_USER:-infisical}"
BACKUP_ROOT="${INFISICAL_BACKUP_ROOT:-var/backups/infisical}"
BACKUP_DIRECT="${INFISICAL_BACKUP_DIRECT:-false}"

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }
validate_identifier() { [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "invalid PostgreSQL identifier: $1"; }

database_exec() {
  if [[ "$BACKUP_DIRECT" == "true" ]]; then psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER_NAME" "$@"
  else docker exec "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER_NAME" "$@"; fi
}
database_scalar() { database_exec -tA -d "$1" -c "$2" | tr -d '[:space:]'; }
archive_list() {
  if [[ "$BACKUP_DIRECT" == "true" ]]; then pg_restore -l "$1" >/dev/null
  else docker exec -i "$CONTAINER_NAME" pg_restore -l < "$1" >/dev/null; fi
}
create_backup() {
  local output="$1"
  mkdir -p "$(dirname "$output")"
  umask 077
  if [[ "$BACKUP_DIRECT" == "true" ]]; then pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$SOURCE_DATABASE" > "$output"
  else docker inspect "$CONTAINER_NAME" >/dev/null 2>&1 || fail "Infisical PostgreSQL container is not available: $CONTAINER_NAME"; docker exec "$CONTAINER_NAME" pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$SOURCE_DATABASE" > "$output"; fi
  chmod 600 "$output"
  archive_list "$output"
  sha256sum "$output" | tee "${output}.sha256" >/dev/null
  chmod 600 "${output}.sha256"
  printf 'Infisical backup created and structurally validated: %s\n' "$output"
}
verify_backup() {
  local archive="$1" checksum="${1}.sha256"
  [[ -s "$archive" ]] || fail "backup file is missing or empty: $archive"
  [[ -s "$checksum" ]] || fail "backup checksum is missing or empty: $checksum"
  [[ "$(awk 'NR == 1 { print $1 }' "$checksum" | tr '[:upper:]' '[:lower:]')" == "$(sha256sum "$archive" | awk '{ print $1 }')" ]] || fail "backup checksum mismatch: $archive"
  archive_list "$archive"
  local verify_database="infisical_restore_test_$(date -u +%Y%m%d%H%M%S)_$$"
  validate_identifier "$verify_database"
  cleanup() { local status=$?; trap - EXIT; database_exec -d postgres -c "DROP DATABASE IF EXISTS \"$verify_database\" WITH (FORCE);" >/dev/null || true; exit "$status"; }
  trap cleanup EXIT
  database_exec -d postgres -c "CREATE DATABASE \"$verify_database\";" >/dev/null
  if [[ "$BACKUP_DIRECT" == "true" ]]; then pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$verify_database" "$archive"
  else docker exec -i "$CONTAINER_NAME" pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$verify_database" < "$archive"; fi
  local table count
  for table in users organizations projects secrets secret_versions audit_logs; do
    [[ "$(database_scalar "$verify_database" "SELECT to_regclass('public.$table') IS NOT NULL;")" == "t" ]] || fail "restored Infisical database is missing table: $table"
    count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM $table;")"
    [[ "$count" =~ ^[0-9]+$ ]] || fail "restored Infisical table cannot be counted: $table"
  done
  printf 'Infisical restore verification passed in disposable database: %s\n' "$verify_database"
  database_exec -d postgres -c "DROP DATABASE IF EXISTS \"$verify_database\" WITH (FORCE);" >/dev/null
  trap - EXIT
}

[[ $# -ge 1 ]] || { printf 'Usage: %s backup-verify [output-file] | verify <backup-file>\n' "$0" >&2; exit 2; }
if [[ "$BACKUP_DIRECT" == "true" ]]; then require_command psql; require_command pg_dump; require_command pg_restore; else require_command docker; fi
require_command sha256sum
case "$1" in
  backup-verify) output="${2:-$BACKUP_ROOT/infisical_$(date -u +%Y%m%dT%H%M%SZ).dump}"; create_backup "$output"; verify_backup "$output" ;;
  verify) [[ $# -eq 2 ]] || fail 'verify requires a backup file'; verify_backup "$2" ;;
  *) fail 'unsupported command' ;;
esac
