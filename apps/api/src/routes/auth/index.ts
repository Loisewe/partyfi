import type { FastifyPluginAsync } from 'fastify'
import { createHmac, createHash } from 'crypto'
import { requireAuth } from '../../plugins/auth'

/**
 * Verify Telegram Login Widget callback.
 * Spec: https://core.telegram.org/widgets/login#checking-authorization
 *
 * Differs from initData: secret_key = SHA256(bot_token) directly (no 'WebAppData'
 * prefix), and the user fields are sent flat (not nested in 'user' JSON).
 */
function verifyTelegramLoginWidget(
  payload: Record<string, string>,
  botToken: string,
  maxAgeSeconds = 86400,
): {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
} | null {
  const { hash, ...rest } = payload
  if (!hash) return null

  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (expectedHash !== hash) return null

  const authDate = parseInt(rest.auth_date ?? '0', 10)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null
  if (!rest.id) return null

  return {
    id: String(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
    photo_url: rest.photo_url,
  }
}

/**
 * Verify Telegram WebApp initData.
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns the parsed user object if valid, null otherwise.
 */
function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
} | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (expectedHash !== hash) return null

  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null

  const userJson = params.get('user')
  if (!userJson) return null

  try {
    const user = JSON.parse(userJson)
    if (!user.id) return null
    return { ...user, id: String(user.id) }
  } catch {
    return null
  }
}

export const authRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /bot/my-events ──────────────────────────────────────────────────
  // Bot-only endpoint (HMAC via BOT_WEBHOOK_SECRET). Returns hosted + invited
  // events for a Telegram user. Used by /myevents bot command.
  app.post('/bot/my-events', async (request, reply) => {
    const callerSecret = request.headers['x-bot-secret']
    const expected = process.env.BOT_WEBHOOK_SECRET ?? process.env.JWT_SECRET
    if (!expected || callerSecret !== expected) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { telegramId } = request.body as { telegramId?: string }
    if (!telegramId) return reply.status(400).send({ error: 'telegramId required' })

    const user = await app.prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    })
    if (!user) return { hosted: [], invited: [] }

    const [hosted, invited] = await Promise.all([
      app.prisma.event.findMany({
        where: { hostUserId: user.id, status: 'ACTIVE' },
        select: { id: true, title: true, shareToken: true, startsAt: true },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),
      app.prisma.event.findMany({
        where: {
          rsvps: { some: { guestUserId: user.id, status: 'GOING' } },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          shareToken: true,
          startsAt: true,
          host: { select: { name: true, nickname: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),
    ])

    return {
      hosted: hosted.map((e) => ({
        title: e.title,
        shareToken: e.shareToken,
        startsAt: e.startsAt.toISOString(),
      })),
      invited: invited.map((e) => ({
        title: e.title,
        shareToken: e.shareToken,
        startsAt: e.startsAt.toISOString(),
        hostName: e.host.name ?? e.host.nickname ?? 'хост',
      })),
    }
  })

  // ── POST /auth/telegram-init ────────────────────────────────────────────
  // Verifies Telegram WebApp initData, upserts user by telegramId, returns JWT.

  app.post('/telegram-init', async (request, reply) => {
    const { initData } = request.body as { initData?: string }
    if (!initData) return reply.status(400).send({ error: 'initData required' })

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return reply.status(503).send({ error: 'Telegram auth not configured on server' })
    }

    const tgUser = verifyTelegramInitData(initData, botToken)
    if (!tgUser) return reply.status(401).send({ error: 'Invalid initData' })

    const displayName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() ||
      tgUser.username ||
      null

    // Upsert by telegramId
    const user = await app.prisma.user.upsert({
      where: { telegramId: tgUser.id },
      create: {
        telegramId: tgUser.id,
        telegramUsername: tgUser.username ?? null,
        name: displayName,
        avatarUrl: tgUser.photo_url ?? null,
        nickname: displayName ?? `tg-${tgUser.id.slice(0, 6)}`,
        isAnonymous: false,
      },
      update: {
        telegramUsername: tgUser.username ?? null,
        name: displayName,
        avatarUrl: tgUser.photo_url ?? null,
      },
    })

    const token = await reply.jwtSign({ sub: user.id, telegramId: user.telegramId })

    return {
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        telegramUsername: user.telegramUsername,
      },
      accessToken: token,
    }
  })



  // ── POST /auth/telegram-login ───────────────────────────────────────────
  // Verifies Telegram Login Widget callback (different signature from initData
  // because Login Widget uses raw bot-token SHA256 instead of 'WebAppData'
  // HMAC and posts user fields flat instead of nested).
  // Spec: https://core.telegram.org/widgets/login#checking-authorization
  app.post('/telegram-login', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    const payload = request.body as Record<string, string>
    if (!payload || typeof payload !== 'object') {
      return reply.status(400).send({ error: 'payload required' })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return reply.status(503).send({ error: 'Telegram auth not configured' })
    }

    const tgUser = verifyTelegramLoginWidget(payload, botToken)
    if (!tgUser) return reply.status(401).send({ error: 'Invalid login signature' })

    const displayName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() ||
      tgUser.username ||
      null

    const user = await app.prisma.user.upsert({
      where: { telegramId: tgUser.id },
      create: {
        telegramId: tgUser.id,
        telegramUsername: tgUser.username ?? null,
        name: displayName,
        avatarUrl: tgUser.photo_url ?? null,
        nickname: displayName ?? `tg-${tgUser.id.slice(0, 6)}`,
        isAnonymous: false,
      },
      update: {
        telegramUsername: tgUser.username ?? null,
        name: displayName ?? undefined,
        avatarUrl: tgUser.photo_url ?? undefined,
      },
    })

    const token = await reply.jwtSign({ sub: user.id, telegramId: user.telegramId })

    return {
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        telegramUsername: user.telegramUsername,
      },
      accessToken: token,
    }
  })

  // ── POST /auth/merge ────────────────────────────────────────────────────
  // Called after sign-in by the Next.js client.
  // Moves all wishlists/reservations from anonymous users (identified by
  // their editTokens) to the now-authenticated user.

  app.post('/merge', async (request, reply) => {
    const authUser = requireAuth(request)
    const { editTokens } = request.body as { editTokens?: string[] }

    if (!Array.isArray(editTokens) || editTokens.length === 0) {
      return reply.status(400).send({ error: 'editTokens array required' })
    }

    // Find anonymous users by their wishlist editTokens
    const wishlists = await app.prisma.wishlist.findMany({
      where: { editToken: { in: editTokens } },
      include: { user: true },
    })

    const anonUserIds = [
      ...new Set(
        wishlists
          .filter((w) => w.user.isAnonymous && w.userId !== authUser.id)
          .map((w) => w.userId),
      ),
    ]

    if (anonUserIds.length === 0) {
      return { merged: 0 }
    }

    // Transfer wishlists and reservations, then delete anonymous users
    await app.prisma.$transaction([
      app.prisma.wishlist.updateMany({
        where: { userId: { in: anonUserIds } },
        data: { userId: authUser.id },
      }),
      app.prisma.reservation.updateMany({
        where: { userId: { in: anonUserIds } },
        data: { userId: authUser.id },
      }),
      app.prisma.user.deleteMany({
        where: { id: { in: anonUserIds }, isAnonymous: true },
      }),
    ])

    return { merged: anonUserIds.length }
  })
}
