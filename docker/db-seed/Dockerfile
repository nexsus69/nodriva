FROM node:24-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/core packages/core
RUN pnpm --filter @dashboard/core build

COPY docker/db-seed/bootstrap.mjs /app/bootstrap.mjs

CMD ["node", "/app/bootstrap.mjs"]
