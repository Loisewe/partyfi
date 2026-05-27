# ─── 1. Builder ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /repo

# Copy workspace manifests first (better cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @wishly/api... --filter @wishly/db... --filter @wishly/shared...

# Copy sources
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/api apps/api

# Generate Prisma client + compile TS
RUN pnpm --filter @wishly/db exec prisma generate
RUN pnpm --filter @wishly/api exec tsc -p tsconfig.build.json

# Prune dev deps
RUN pnpm prune --prod

# ─── 2. Runtime ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Copy only what's needed at runtime
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/packages/db ./packages/db
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
