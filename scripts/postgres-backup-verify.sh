#!/usr/bin/env bash
set -Eeuo pipefail

# Operational backup workflow for the local PostgreSQL deployment.
# The verify path always restores into a disposable database and never into
# the configured application database.

CONTAINER_NAME="${POSTGRES_CONTAINER:-dashboard-db-pg17}"
SOURCE_DATABASE="${POSTGRES_DATABASE:-dashboard}"
POSTGRES_USER_NAME="${POSTGRES_USER:-postgres}"
BACKUP_ROOT="${BACKUP_ROOT:-var/backups/postgres}"
BACKUP_DIRECT="${BACKUP_DIRECT:-false}"

usage() {
  printf '%s\n' \
    "Usage:" \
    "  $0 backup [output-file]" \
    "  $0 verify <backup-file>" \
    "  $0 backup-verify [output-file]"
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

validate_identifier() {
  [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "invalid PostgreSQL identifier: $1"
}

validate_backup_file() {
  [[ -f "$1" ]] || fail "backup file not found: $1"
  [[ -s "$1" ]] || fail "backup file is empty: $1"
}

validate_checksum() {
  local backup_path="$1"
  local checksum_path="${backup_path}.sha256"
  [[ -f "$checksum_path" ]] || fail "backup checksum not found: $checksum_path"
  [[ -s "$checksum_path" ]] || fail "backup checksum is empty: $checksum_path"

  local expected_checksum actual_checksum
  expected_checksum="$(awk 'NR == 1 { print $1 }' "$checksum_path" | tr '[:upper:]' '[:lower:]')"
  [[ "$expected_checksum" =~ ^[0-9a-fA-F]{64}$ ]] || fail "backup checksum is invalid: $checksum_path"
  actual_checksum="$(sha256sum "$backup_path" | awk '{ print $1 }')"
  [[ "$actual_checksum" == "$expected_checksum" ]] || fail "backup checksum mismatch: $backup_path"
}

database_exec() {
  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    psql -X -v ON_ERROR_STOP=1 "$@"
  else
    docker exec "$CONTAINER_NAME" psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER_NAME" "$@"
  fi
}

database_scalar() {
  database_exec -tA -d "$1" -c "$2" | tr -d '[:space:]'
}

create_backup() {
  local requested_path="${1:-}"
  local output_path
  if [[ -n "$requested_path" ]]; then
    output_path="$requested_path"
  else
    mkdir -p "$BACKUP_ROOT"
    output_path="$BACKUP_ROOT/${SOURCE_DATABASE}_$(date -u +%Y%m%dT%H%M%SZ).dump"
  fi
  mkdir -p "$(dirname "$output_path")"
  umask 077

  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$SOURCE_DATABASE" > "$output_path"
  else
    docker inspect "$CONTAINER_NAME" >/dev/null 2>&1 || fail "PostgreSQL container is not available: $CONTAINER_NAME"
    docker exec "$CONTAINER_NAME" pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$SOURCE_DATABASE" > "$output_path"
  fi
  chmod 600 "$output_path"
  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    pg_restore -l "$output_path" >/dev/null
  else
    docker exec -i "$CONTAINER_NAME" pg_restore -l < "$output_path" >/dev/null
  fi
  sha256sum "$output_path" | tee "${output_path}.sha256"
  chmod 600 "${output_path}.sha256"
  printf 'Backup created and structurally validated: %s\n' "$output_path"
}

verify_backup() {
  local backup_path="$1"
  validate_backup_file "$backup_path"
  validate_checksum "$backup_path"
  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    pg_restore -l "$backup_path" >/dev/null || fail "pg_restore cannot read backup archive"
  else
    docker exec -i "$CONTAINER_NAME" pg_restore -l < "$backup_path" >/dev/null || fail "pg_restore cannot read backup archive"
  fi

  local verify_database="dashboard_restore_test_$(date -u +%Y%m%d%H%M%S)_$$"
  validate_identifier "$verify_database"
  local cleanup_required=1
  cleanup() {
    local status=$?
    trap - EXIT
    if [[ "$cleanup_required" -eq 1 ]]; then
      database_exec -d postgres -c "DROP DATABASE IF EXISTS \"$verify_database\" WITH (FORCE);" >/dev/null || true
    fi
    exit "$status"
  }
  trap cleanup EXIT

  database_exec -d postgres -c "CREATE DATABASE \"$verify_database\";" >/dev/null
  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$verify_database" "$backup_path"
  else
    docker exec -i "$CONTAINER_NAME" pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER_NAME" -d "$verify_database" < "$backup_path"
  fi

  local required_tables=(users nodes entities node_types entity_types audit_logs runtime_capabilities realtime_event_outbox resource_attachments resource_field_ciphertexts resource_relationships)
  local table_name
  for table_name in "${required_tables[@]}"; do
    [[ "$(database_scalar "$verify_database" "SELECT to_regclass('public.$table_name') IS NOT NULL;")" == "t" ]] || fail "restored database is missing table: $table_name"
  done

  local users_count nodes_count entities_count audit_count attachment_count relationship_count
  users_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM users;")"
  nodes_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM nodes;")"
  entities_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM entities;")"
  audit_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM audit_logs;")"
  attachment_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM resource_attachments;")"
  relationship_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM resource_relationships;")"
  for restored_count in "$users_count" "$nodes_count" "$entities_count" "$audit_count" "$attachment_count" "$relationship_count"; do
    [[ "$restored_count" =~ ^[0-9]+$ ]] || fail "restored core table cannot be counted"
  done
  [[ "$(database_scalar "$verify_database" "SELECT COUNT(*) FROM pg_class WHERE relkind IN ('r','p','v','m');")" -gt 0 ]] || fail "restored catalog contains no relations"

  local data_table restored_count dynamic_table_count=0 dynamic_row_count=0
  for data_table in users nodes entities node_types entity_types audit_logs resource_attachments resource_field_ciphertexts realtime_event_outbox; do
    restored_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM $data_table;")"
    [[ "$restored_count" =~ ^[0-9]+$ ]] || fail "restored table cannot be counted: $data_table"
  done

  while IFS= read -r data_table; do
    validate_identifier "$data_table"
    [[ "$(database_scalar "$verify_database" "SELECT to_regclass('public.$data_table') IS NOT NULL;")" == "t" ]] \
      || fail "restored dynamic storage table is missing: $data_table"
    restored_count="$(database_scalar "$verify_database" "SELECT COUNT(*) FROM \"$data_table\";")"
    [[ "$restored_count" =~ ^[0-9]+$ ]] || fail "restored dynamic storage table cannot be counted: $data_table"
    dynamic_table_count=$((dynamic_table_count + 1))
    dynamic_row_count=$((dynamic_row_count + restored_count))
  done < <(database_exec -tA -d "$verify_database" -c "SELECT storage_table FROM entity_types WHERE deleted_at IS NULL AND storage_table IS NOT NULL ORDER BY storage_table;")

  printf 'Restore verification passed in disposable database: %s (users=%s nodes=%s entities=%s audit=%s attachments=%s relationships=%s dynamic-tables=%s dynamic-rows=%s)\n' \
    "$verify_database" "$users_count" "$nodes_count" "$entities_count" "$audit_count" "$attachment_count" "$relationship_count" "$dynamic_table_count" "$dynamic_row_count"
  database_exec -d postgres -c "DROP DATABASE IF EXISTS \"$verify_database\" WITH (FORCE);" >/dev/null
  cleanup_required=0
  trap - EXIT
}

main() {
  if [[ "$BACKUP_DIRECT" == "true" ]]; then
    require_command psql
    require_command pg_dump
    require_command pg_restore
  else
    require_command docker
  fi
  require_command sha256sum
  [[ $# -ge 1 ]] || { usage; exit 2; }
  case "$1" in
    backup)
      create_backup "${2:-}"
      ;;
    verify)
      [[ $# -eq 2 ]] || { usage; exit 2; }
      verify_backup "$2"
      ;;
    backup-verify)
      local backup_path="${2:-}"
      if [[ -z "$backup_path" ]]; then
        mkdir -p "$BACKUP_ROOT"
        backup_path="$BACKUP_ROOT/${SOURCE_DATABASE}_$(date -u +%Y%m%dT%H%M%SZ).dump"
      fi
      create_backup "$backup_path"
      verify_backup "$backup_path"
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

main "$@"
