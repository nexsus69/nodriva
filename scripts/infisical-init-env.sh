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
  printf 'INFISICAL_SITE_URL=http://127.0.0.1:8080\n'
} >"$target_path"

chmod 600 "$target_path"
printf 'Segreti Infisical generati in %s (permessi 600).\n' "$target_path"
printf 'Conservali in un backup cifrato: la ENCRYPTION_KEY e necessaria per il restore.\n'
