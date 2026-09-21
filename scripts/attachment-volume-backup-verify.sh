#!/usr/bin/env bash
set -Eeuo pipefail

# Archives opaque attachment payloads. Database metadata is backed up separately
# by PostgreSQL; this verifier proves that every payload path and byte survives
# the archive/restore cycle without exposing file names or contents.
SOURCE_ROOT="${ATTACHMENTS_BACKUP_SOURCE_ROOT:-/attachments-source}"
BACKUP_ROOT="${ATTACHMENTS_BACKUP_ROOT:-/backups/attachments}"

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
verify() {
  local archive="$1" checksum="${1}.sha256" restore_root source_count restored_count
  [[ -s "$archive" && -s "$checksum" ]] || fail 'attachment archive or checksum is missing'
  [[ "$(awk 'NR == 1 {print $1}' "$checksum")" == "$(sha256sum "$archive" | awk '{print $1}')" ]] || fail 'attachment archive checksum mismatch'
  restore_root="$(mktemp -d /tmp/nodriva-attachments-restore-test-XXXXXX)"
  cleanup() { rm -rf "$restore_root"; }
  trap cleanup EXIT
  tar -xf "$archive" -C "$restore_root"
  source_count="$(tar -tf "$archive" | grep -vc '/$' || true)"
  restored_count="$(find "$restore_root" -type f | wc -l | tr -d '[:space:]')"
  [[ "$source_count" == "$restored_count" ]] || fail 'attachment restore file count differs from archive'
  while IFS= read -r -d '' restored_file; do
    relative_path="${restored_file#"$restore_root"/}"
    [[ -f "$SOURCE_ROOT/$relative_path" ]] || fail 'attachment restore path is absent from source'
    [[ "$(sha256sum "$restored_file" | awk '{print $1}')" == "$(sha256sum "$SOURCE_ROOT/$relative_path" | awk '{print $1}')" ]] || fail 'attachment restore payload checksum differs'
  done < <(find "$restore_root" -type f -print0)
  printf 'Attachment restore verification passed (payload-files=%s)\n' "$restored_count"
  cleanup
  trap - EXIT
}

[[ -d "$SOURCE_ROOT" ]] || fail "attachment source root is unavailable: $SOURCE_ROOT"
case "${1:-}" in
  backup-verify)
    archive="${2:-$BACKUP_ROOT/attachments_$(date -u +%Y%m%dT%H%M%SZ).tar}"
    mkdir -p "$(dirname "$archive")"; umask 077
    tar -C "$SOURCE_ROOT" -cf "$archive" .
    chmod 600 "$archive"; sha256sum "$archive" > "${archive}.sha256"; chmod 600 "${archive}.sha256"
    verify "$archive"
    ;;
  verify) [[ $# -eq 2 ]] || fail 'verify requires an archive path'; verify "$2" ;;
  *) fail 'Usage: attachment-volume-backup-verify.sh backup-verify [archive] | verify <archive>' ;;
esac
