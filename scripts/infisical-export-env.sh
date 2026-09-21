#!/usr/bin/env bash
set -Eeuo pipefail

deploy_env="${INFISICAL_DEPLOY_ENV_FILE:-$HOME/.config/nodriva/infisical-deploy.env}"
target_path="${1:-$HOME/.config/nodriva/dashboard-production.env}"
base_env="${2:-${INFISICAL_BASE_ENV_FILE:-}}"

test -r "$deploy_env" || {
  printf 'File di autenticazione non leggibile: %s\n' "$deploy_env" >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || { printf 'curl e richiesto.\n' >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { printf 'jq e richiesto.\n' >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$deploy_env"
set +a

: "${INFISICAL_URL:?INFISICAL_URL mancante}"
: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID mancante}"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET mancante}"
: "${INFISICAL_PROJECT_SLUG:?INFISICAL_PROJECT_SLUG mancante}"
: "${INFISICAL_ENVIRONMENT:?INFISICAL_ENVIRONMENT mancante}"
secret_path="${INFISICAL_SECRET_PATH:-/}"

auth_payload="$(jq -nc --arg id "$INFISICAL_CLIENT_ID" --arg secret "$INFISICAL_CLIENT_SECRET" \
  '{clientId:$id,clientSecret:$secret}')"
access_token="$(curl -fsS --max-time 15 -H 'Content-Type: application/json' \
  -d "$auth_payload" "$INFISICAL_URL/api/v1/auth/universal-auth/login" | jq -er '.accessToken')"

project_id="$(curl -fsS --max-time 15 -H "Authorization: Bearer $access_token" \
  "$INFISICAL_URL/api/v1/projects" | jq -er --arg slug "$INFISICAL_PROJECT_SLUG" \
  '.projects[] | select(.slug == $slug) | .id')"

secrets_json="$(curl -fsS --max-time 15 -H "Authorization: Bearer $access_token" \
  "$INFISICAL_URL/api/v4/secrets?projectId=$project_id&environment=$INFISICAL_ENVIRONMENT&secretPath=$secret_path&viewSecretValue=true")"
secret_count="$(jq '.secrets | length' <<<"$secrets_json")"
(( secret_count > 0 )) || { printf 'Nessun secret trovato nel percorso %s.\n' "$secret_path" >&2; exit 1; }
if [[ -n "$base_env" && ! -r "$base_env" ]]; then
  printf 'File base non leggibile: %s\n' "$base_env" >&2
  exit 1
fi

target_dir="$(dirname "$target_path")"
install -d -m 700 "$target_dir"
umask 077
tmp_path="$(mktemp "$target_dir/.dashboard-env.XXXXXX")"
secret_keys_path="$(mktemp "$target_dir/.dashboard-secret-keys.XXXXXX")"
trap 'rm -f "$tmp_path" "$secret_keys_path"' EXIT

jq -r '.secrets[].secretKey' <<<"$secrets_json" >"$secret_keys_path"
if [[ -n "$base_env" ]]; then
  awk -F= -v skip_file="$secret_keys_path" '
    BEGIN { while ((getline key < skip_file) > 0) skip[key] = 1 }
    /^[A-Za-z_][A-Za-z0-9_]*=/ { if (!skip[$1]) print; next }
    { print }
  ' "$base_env" >"$tmp_path"
fi

# JSON quoting is accepted by Docker Compose dotenv parsing and preserves
# whitespace, quotes and special characters without exposing values in logs.
jq -r '.secrets[] | "\(.secretKey)=\(.secretValue | @json)"' <<<"$secrets_json" >>"$tmp_path"
chmod 600 "$tmp_path"
mv -f "$tmp_path" "$target_path"
rm -f "$secret_keys_path"
trap - EXIT
printf 'Export completato: %s secret in %s (permessi 600).\n' "$secret_count" "$target_path"
