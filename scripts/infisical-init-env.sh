#!/usr/bin/env bash
set -Eeuo pipefail

target_path="${1:-$HOME/.config/dashboard-ultimate/infisical.env}"

if [[ -e "$target_path" ]]; then
  printf 'File gia presente: %s\n' "$target_path" >&2
  printf 'Rimuovilo manualmente se vuoi rigenerare i segreti.\n' >&2
  exit 1
fi

command -v openssl >/dev/null 2>&1 || {
  printf 'openssl e richiesto per generare i segreti.\n' >&2
  exit 1
}

: "${INFISICAL_PUBLIC_URL:?INFISICAL_PUBLIC_URL must be set}"
: "${INFISICAL_BIND_ADDRESS:?INFISICAL_BIND_ADDRESS must be set}"
: "${INFISICAL_HOST_PORT:?INFISICAL_HOST_PORT must be set}"
: "${INFISICAL_PORT:?INFISICAL_PORT must be set}"
: "${INFISICAL_DATABASE_PORT:?INFISICAL_DATABASE_PORT must be set}"
: "${INFISICAL_REDIS_PORT:?INFISICAL_REDIS_PORT must be set}"

target_dir="$(dirname "$target_path")"
install -d -m 700 "$target_dir"
umask 077

encryption_key="$(openssl rand -hex 16)"
auth_secret="$(openssl rand -base64 48 | tr -d '\n')"
db_password="$(openssl rand -base64 36 | tr -d '\n' | tr '/+' '_-')"

{
  printf 'INFISICAL_DB_PASSWORD=%s\n' "$db_password"
  printf 'INFISICAL_ENCRYPTION_KEY=%s\n' "$encryption_key"
  printf 'INFISICAL_AUTH_SECRET=%s\n' "$auth_secret"
  printf 'INFISICAL_PUBLIC_URL=%s\n' "$INFISICAL_PUBLIC_URL"
  printf 'INFISICAL_BIND_ADDRESS=%s\n' "$INFISICAL_BIND_ADDRESS"
  printf 'INFISICAL_HOST_PORT=%s\n' "$INFISICAL_HOST_PORT"
  printf 'INFISICAL_PORT=%s\n' "$INFISICAL_PORT"
  printf 'INFISICAL_DATABASE_PORT=%s\n' "$INFISICAL_DATABASE_PORT"
  printf 'INFISICAL_REDIS_PORT=%s\n' "$INFISICAL_REDIS_PORT"
} >"$target_path"

chmod 600 "$target_path"
printf 'Segreti Infisical generati in %s (permessi 600).\n' "$target_path"
printf 'Conservali in un backup cifrato: la ENCRYPTION_KEY e necessaria per il restore.\n'
