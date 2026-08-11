FROM node:24-bookworm-slim AS build
WORKDIR /app
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
COPY --from=build /app/packages/web/.next/standalone ./
COPY --from=build /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=build /app/packages/web/public ./packages/web/public
RUN mkdir -p /app/data/attachments && chmod 700 /app/data /app/data/attachments
EXPOSE 3000
CMD ["node", "packages/web/server.js"]
