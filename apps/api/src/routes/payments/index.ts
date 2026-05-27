import type { FastifyPluginAsync } from 'fastify'
import { createHmac, randomBytes } from 'crypto'
import { requireAuth } from '../../plugins/auth'

const STARS_AMOUNT = 100  // 100 Telegram Stars (~$1.30) per event upgrade
const PAYLOAD_VERSION = 'v1'

/**
 * Encode an event upgrade payload that survives a TG Stars invoice round-trip.
 * Format: v1.{eventId}.{userId}.{nonce}.{hmac}
 * HMAC binds (eventId, userId, nonce) so bot can't fake an upgrade.
 */
function encodePayload(eventId: string, userId: string, nonce: string, secret: string): string {
  const body = `${PAYLOAD_VERSION}.${eventId}.${userId}.${nonce}`
  const hmac = createHmac('sha256', secret).update(body).digest('hex').slice(0, 16)
  return `${body}.${hmac}`
}

function decodePayload(
  payload: string,
  secret: string,
): { eventId: string; userId: string; nonce: string } | null {
  const parts = payload.split('.')
  if (parts.length !== 5 || parts[0] !== PAYLOAD_VERSION) return null
  const eventId = parts[1]!
  const userId = parts[2]!
  const nonce = parts[3]!
  const hmac = parts[4]!
  const expected = createHmac('sha256', secret)
    .update(`${PAYLOAD_VERSION}.${eventId}.${userId}.${nonce}`)
    .digest('hex')
    .slice(0, 16)
  if (hmac !== expected) return null
  return { eventId, userId, nonce }
}

/**
 * Call Telegram Bot API to create a Stars invoice link.
 * Returns a URL that WebApp.openInvoice() can consume.
 */
async function createTgInvoiceLink(args: {
  botToken: string
  title: string
  description: string
  payload: string
  starsAmount: number
}): Promise<string> {
  const res = await fetch(
    `https://api.telegram.org/bot${args.botToken}/createInvoiceLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: args.title,
        description: args.description,
        payload: args.payload,
        currency: 'XTR',
        prices: [{ label: 'Premium event', amount: args.starsAmount }],
      }),
    },
  )
  const data = (await res.json()) as { ok: boolean; result?: string; description?: string }
  if (!data.ok || !data.result) {
    throw new Error(`TG createInvoiceLink failed: ${data.description ?? 'unknown'}`)
  }
  return data.result
}

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /events/:id/upgrade ────────────────────────────────────────────
  // Host requests TG Stars invoice for premium upgrade. Returns invoice URL.
  app.post('/events/:id/upgrade', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const user = requireAuth(request)
    const { id: eventId } = request.params as { id: string }

    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { upgrade: { select: { id: true } } },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostUserId !== user.id) {
      return reply.status(403).send({ error: 'Only event host can upgrade' })
    }
    if (event.upgrade) {
      return reply.status(409).send({ error: 'Event already premium' })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
    if (!botToken) {
      return reply.status(503).send({ error: 'Telegram payments not configured' })
    }

    const nonce = randomBytes(8).toString('hex')
    const payload = encodePayload(eventId, user.id, nonce, secret)

    try {
      const invoiceUrl = await createTgInvoiceLink({
        botToken,
        title: `Премиум-ивент: ${event.title}`,
        description: 'Кастомный URL, расширенная аналитика, безлимит фото',
        payload,
        starsAmount: STARS_AMOUNT,
      })
      return { invoiceUrl, starsAmount: STARS_AMOUNT }
    } catch (err) {
      app.log.error({ err: (err as Error).message }, 'TG invoice creation failed')
      return reply.status(502).send({ error: 'Не удалось создать счёт. Попробуй позже.' })
    }
  })

  // ── POST /payments/tg-stars/confirm ─────────────────────────────────────
  // Internal: called by bot after successful_payment. HMAC-signed via shared secret.
  app.post('/payments/tg-stars/confirm', async (request, reply) => {
    const callerSecret = request.headers['x-bot-secret']
    const expected = process.env.BOT_WEBHOOK_SECRET ?? process.env.JWT_SECRET
    if (!expected || callerSecret !== expected) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as {
      payload: string
      tgPaymentChargeId: string
      starAmount: number
      telegramUserId: string
    }

    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
    const decoded = decodePayload(body.payload, secret)
    if (!decoded) {
      return reply.status(400).send({ error: 'Invalid payload' })
    }

    // Idempotency check via tgPaymentChargeId (unique)
    const existing = await app.prisma.eventUpgrade.findUnique({
      where: { tgPaymentChargeId: body.tgPaymentChargeId },
    })
    if (existing) {
      return { upgrade: existing, idempotent: true }
    }

    // Verify event exists and not already upgraded
    const event = await app.prisma.event.findUnique({
      where: { id: decoded.eventId },
      include: { upgrade: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.upgrade) {
      return reply.status(409).send({ error: 'Event already premium' })
    }

    const upgrade = await app.prisma.eventUpgrade.create({
      data: {
        eventId: decoded.eventId,
        purchaserUserId: decoded.userId,
        starsAmount: body.starAmount,
        tgPaymentChargeId: body.tgPaymentChargeId,
        features: {
          customSlug: true,
          unlimitedPhotos: true,
          analytics: true,
        },
      },
    })

    app.log.info(
      { eventId: decoded.eventId, stars: body.starAmount, chargeId: body.tgPaymentChargeId },
      '[payments] event upgraded',
    )

    return { upgrade, idempotent: false }
  })
}
