# Build context is the repo root (npm workspaces monorepo).
# docker build -f apps/web/Dockerfile .

FROM node:26-bookworm-slim AS builder
WORKDIR /app

# Base image's bundled npm vendors its own deps (tar, sigstore, picomatch,
# brace-expansion); update it so those get scanned/patched independently of
# our own dependency tree.
RUN npm install -g npm@latest

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build --workspace packages/shared
# Next's build-time lockfile-patch check makes a registry HTTP call that this
# sandboxed build environment can't reach, crashing an otherwise-successful
# build; NEXT_IGNORE_INCORRECT_LOCKFILE skips that legacy check entirely (it
# only ever mattered for a bug in npm 8.3–8.4, long since irrelevant here).
RUN NEXT_IGNORE_INCORRECT_LOCKFILE=1 npm run build --workspace apps/web
# npm's hoisting outcome for apps/web/node_modules (nested vs. fully hoisted
# to root) depends on the current dependency graph and can change between
# installs — e.g. `next` itself currently nests here rather than at root.
# Ensure the directory exists either way so the COPY below never fails.
RUN mkdir -p apps/web/node_modules

FROM node:26-bookworm-slim AS runtime
WORKDIR /app

RUN npm install -g npm@latest

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next

WORKDIR /app/apps/web

# WEB_PORT controls the port next start binds to inside the container; the host-side
# port mapping is set separately via WEB_PORT in docker-compose.yml.
CMD ["sh", "-c", "npx next start -p \"${WEB_PORT:-3000}\" -H 0.0.0.0"]
