# Build context is the repo root (npm workspaces monorepo).
# docker build -f apps/web/Dockerfile .

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next

WORKDIR /app/apps/web

# WEB_PORT controls the port next start binds to inside the container; the host-side
# port mapping is set separately via WEB_PORT in docker-compose.yml.
CMD ["sh", "-c", "npx next start -p \"${WEB_PORT:-3000}\" -H 0.0.0.0"]
