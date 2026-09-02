FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS=1800
ENV NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS=${NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS}
ARG NEXT_PUBLIC_REALTIME_ENABLED=false
ENV NEXT_PUBLIC_REALTIME_ENABLED=${NEXT_PUBLIC_REALTIME_ENABLED}
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER=mt1
ARG NEXT_PUBLIC_PUSHER_HOST=localhost
ARG NEXT_PUBLIC_PUSHER_PORT=6001
ARG NEXT_PUBLIC_PUSHER_SCHEME=http
ENV NEXT_PUBLIC_PUSHER_KEY=${NEXT_PUBLIC_PUSHER_KEY} \
    NEXT_PUBLIC_PUSHER_CLUSTER=${NEXT_PUBLIC_PUSHER_CLUSTER} \
    NEXT_PUBLIC_PUSHER_HOST=${NEXT_PUBLIC_PUSHER_HOST} \
    NEXT_PUBLIC_PUSHER_PORT=${NEXT_PUBLIC_PUSHER_PORT} \
    NEXT_PUBLIC_PUSHER_SCHEME=${NEXT_PUBLIC_PUSHER_SCHEME}
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/core/package.json packages/core/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm approve-builds --all && pnpm rebuild
COPY . .
RUN pnpm --filter @dashboard/core build && pnpm --filter @dashboard/web build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --chown=node:node --from=build /app/packages/web/.next/standalone ./
COPY --chown=node:node --from=build /app/packages/web/.next/static ./packages/web/.next/static
COPY --chown=node:node --from=build /app/packages/web/public ./packages/web/public
RUN mkdir -p /app/data/attachments && chown -R node:node /app/data && chmod 700 /app/data /app/data/attachments
USER node
EXPOSE 3000
CMD ["node", "packages/web/server.js"]
