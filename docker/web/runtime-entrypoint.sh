#!/bin/sh
set -eu

: "${DASHBOARD_WEB_PASSWORD:?DASHBOARD_WEB_PASSWORD must be set}"
: "${DASHBOARD_POSTGRES_HOST:?DASHBOARD_POSTGRES_HOST must be set}"
: "${DASHBOARD_POSTGRES_PORT:?DASHBOARD_POSTGRES_PORT must be set}"

# A PostgreSQL URI cannot contain a raw password: characters such as /, @ and
# % have URL meanings. Keep the password as an ordinary Compose secret and
# encode it only while building the runtime connection URI.
encoded_password="$(node -p 'encodeURIComponent(process.env.DASHBOARD_WEB_PASSWORD)')"
export DATABASE_URL="postgresql://dashboard_web:${encoded_password}@${DASHBOARD_POSTGRES_HOST}:${DASHBOARD_POSTGRES_PORT}/dashboard"

exec node packages/web/server.js
