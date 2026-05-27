import type { FastifyPluginAsync } from 'fastify'
import { scrapeUrlSchema } from '@wishly/shared'
import { scrapeUrl } from '../../services/scraper.service'

export const scrapeRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /scrape ────────────────────────────────────────────────────────
  // Scrape URL metadata — usable directly from the frontend for instant preview.
  // Rate limited: 10 requests/minute per IP.

  app.post(
    '/',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { url } = scrapeUrlSchema.parse(request.body)

      const redisWrapper = {
        get: (key: string) => app.redis.get(key),
        set: (key: string, ttl: number, value: string) => app.redis.setex(key, ttl, value),
      }

      const result = await scrapeUrl(url, redisWrapper)

      return result
    },
  )
}
