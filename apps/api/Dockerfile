# Build context is the repo root (npm workspaces monorepo).
# docker build -f apps/api/Dockerfile .

FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace packages/shared
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# poppler-utils provides pdftoppm, used to render PDF page 1 thumbnails (see
# thumbnail.ts) — poppler has its own font rendering, unlike pdfjs-dist+canvas which
# can't load embedded PDF fonts from memory. openssl is needed by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
# npm workspaces nests some deps (e.g. @fastify/cors) under the workspace's own
# node_modules instead of hoisting to the root when versions conflict.
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
