FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/bot/package.json apps/bot/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @wishly/bot... --filter @wishly/shared...

COPY packages/shared packages/shared
COPY apps/bot apps/bot

RUN pnpm --filter @wishly/bot exec tsc -p tsconfig.build.json
RUN pnpm prune --prod

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/bot/dist ./apps/bot/dist
COPY --from=builder /repo/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=builder /repo/apps/bot/package.json ./apps/bot/
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/

CMD ["node", "apps/bot/dist/index.js"]
