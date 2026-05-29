import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { prismaPlugin } from './plugins/prisma'
import { redisPlugin } from './plugins/redis'
import { authPlugin } from './plugins/auth'

import { wishlistRoutes } from './routes/wishlists'
import { itemRoutes } from './routes/items'
import { scrapeRoutes } from './routes/scrape'
import { userRoutes } from './routes/users'
import { reservationRoutes } from './routes/reservations'
import { authRoutes } from './routes/auth'
import { sseRoutes } from './routes/sse'
import { eventRoutes } from './routes/events'
import { eventCoverPresetRoutes } from './routes/event-cover-presets'
import { clientErrorRoutes } from './routes/_client-error'
import { eventDiscoverRoutes } from './routes/event-discover'
import { organizationRoutes } from './routes/organizations'
import { eventPhotoRoutes, localUploadsRoute } from './routes/event-photos'
import { eventCoHostRoutes } from './routes/event-co-hosts'
import { eventAnalyticsRoutes } from './routes/event-analytics'
import { paymentRoutes } from './routes/payments'
import { startRemindersWorker } from './services/reminders.service'
import { startAutoCloneWorker } from './services/auto-clone.service'

// Crash-safety: log instead of exit on async errors caught by Node's
// global handlers. Fastify route errors are already handled by setErrorHandler.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

async function main() {
  // ── Plugins ──────────────────────────────────────────────────────────────

  // CORS: allow main WEB_URL, TG Mini App origin, localhost dev,
  // and any ngrok tunnel in dev. Function-based to support wildcard match.
  const staticAllowed = new Set(
    [
      process.env.WEB_URL ?? 'http://localhost:3000',
      process.env.TELEGRAM_MINI_APP_URL ?? '',
      'http://localhost:3000',
    ].filter(Boolean),
  )
  await app.register(cors, {
    origin(origin, cb) {
      if (!origin) return cb(null, true)  // server-to-server / curl
      if (staticAllowed.has(origin)) return cb(null, true)
      // Dev: allow ngrok tunnels (.ngrok-free.dev / .ngrok-free.app / .ngrok.io)
      if (/^https?:\/\/[a-z0-9-]+\.ngrok(-free)?\.(dev|app|io)$/i.test(origin)) {
        return cb(null, true)
      }
      cb(new Error(`CORS blocked: ${origin}`), false)
    },
    credentials: true,
  })

  await app.register(jwt, {
    secret: {
      private: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      public: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    },
    sign: { expiresIn: '15m' },
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis: undefined, // will use in-memory for now; replace with redis instance after plugin
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Event Gallery API',
        description: 'Wishlist platform API',
        version: '1.0.0',
      },
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  })

  // ── Custom plugins ────────────────────────────────────────────────────────

  await app.register(prismaPlugin)
  await app.register(redisPlugin)
  await app.register(authPlugin)

  // ── Routes ────────────────────────────────────────────────────────────────

  await app.register(wishlistRoutes, { prefix: '/api/v1/wishlists' })
  await app.register(itemRoutes, { prefix: '/api/v1/wishlists' })
  await app.register(scrapeRoutes, { prefix: '/api/v1/scrape' })
  await app.register(userRoutes, { prefix: '/api/v1/users' })
  await app.register(reservationRoutes, { prefix: '/api/v1' })
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(sseRoutes, { prefix: '/api/v1' })
  await app.register(eventRoutes, { prefix: '/api/v1/events' })
  await app.register(eventCoverPresetRoutes, { prefix: '/api/v1/event-cover-presets' })
  await app.register(eventPhotoRoutes, { prefix: '/api/v1' })
  await app.register(localUploadsRoute)  // mounted at root for /uploads/*
  await app.register(paymentRoutes, { prefix: '/api/v1' })
  await app.register(eventCoHostRoutes, { prefix: '/api/v1' })
  await app.register(eventAnalyticsRoutes, { prefix: '/api/v1' })
  await app.register(clientErrorRoutes, { prefix: '/api/v1' })
  await app.register(eventDiscoverRoutes, { prefix: '/api/v1' })
  await app.register(organizationRoutes, { prefix: '/api/v1/organizations' })

  // ── Background workers ─────────────────────────────────────────────────────
  startRemindersWorker(app.prisma, app)
  startAutoCloneWorker(app.prisma, app)

  // ── Health check ──────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Start ─────────────────────────────────────────────────────────────────

  const port = parseInt(process.env.API_PORT ?? '3001', 10)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Event Gallery API listening on port ${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
