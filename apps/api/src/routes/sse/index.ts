import type { FastifyPluginAsync } from 'fastify'

// SSE channel patterns:
//   wishlist:{wishlistId}  — reservation updates on a wishlist
//   event:{eventId}        — RSVP / cancel / photo upload updates on an event

export const WISHLIST_SSE_CHANNEL = (wishlistId: string) => `wishlist:${wishlistId}`
export const EVENT_SSE_CHANNEL = (eventId: string) => `event:${eventId}`

function setSseHeaders(reply: { raw: import('http').ServerResponse }) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': process.env.WEB_URL ?? 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
  })
}

async function pipeChannelToResponse(
  channel: string,
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
) {
  setSseHeaders(reply)
  reply.raw.write('event: connected\ndata: {}\n\n')

  const Redis = (await import('ioredis')).default
  const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
  await subscriber.subscribe(channel)

  subscriber.on('message', (_chan: string, message: string) => {
    try {
      const data = JSON.parse(message) as { type: string }
      reply.raw.write(`event: ${data.type}\ndata: ${message}\n\n`)
    } catch {
      /* ignore malformed messages */
    }
  })

  const heartbeat = setInterval(() => {
    reply.raw.write(':heartbeat\n\n')
  }, 25_000)

  request.raw.on('close', () => {
    clearInterval(heartbeat)
    subscriber.unsubscribe(channel).finally(() => subscriber.quit())
  })

  await new Promise<void>((resolve) => {
    request.raw.on('close', resolve)
  })
}

export const sseRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /wishlists/:shareToken/events ───────────────────────────────────
  app.get('/wishlists/:shareToken/events', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string }
    const wishlist = await app.prisma.wishlist.findUnique({
      where: { shareToken },
      select: { id: true },
    })
    if (!wishlist) {
      return reply.status(404).send({ error: 'Wishlist not found' })
    }
    await pipeChannelToResponse(WISHLIST_SSE_CHANNEL(wishlist.id), request, reply)
  })

  // ── GET /events/:tokenOrSlug/events ─────────────────────────────────────
  app.get('/events/:tokenOrSlug/events', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true },
    })
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }
    await pipeChannelToResponse(EVENT_SSE_CHANNEL(event.id), request, reply)
  })
}

// ── Publisher helpers ───────────────────────────────────────────────────────

export async function publishWishlistEvent(
  redis: import('ioredis').Redis,
  wishlistId: string,
  event: Record<string, unknown>,
): Promise<void> {
  await redis.publish(WISHLIST_SSE_CHANNEL(wishlistId), JSON.stringify(event))
}

export async function publishEventEvent(
  redis: import('ioredis').Redis,
  eventId: string,
  event: Record<string, unknown>,
): Promise<void> {
  await redis.publish(EVENT_SSE_CHANNEL(eventId), JSON.stringify(event))
}
