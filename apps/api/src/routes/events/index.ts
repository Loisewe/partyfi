import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import {
  createEventSchema,
  updateEventSchema,
  cancelEventSchema,
  verifyPinSchema,
  createRsvpSchema,
  generateNickname,
} from '@wishly/shared'
import { requireAuth } from '../../plugins/auth'
import {
  formatPublicEvent,
  formatOwnerEvent,
  formatGuestList,
} from '../../utils/event-formatter'
import { publishEventEvent } from '../sse'
import { scheduleEventReminders, clearEventReminders } from '../../services/reminders.service'
import { scheduleAutoClone } from '../../services/auto-clone.service'

const EVENT_INCLUDE = {
  host: true,
  coverPreset: true,
  wishlist: { include: { _count: { select: { items: true } } } },
  rsvps: { select: { status: true, plusOnes: true } },
  upgrade: { select: { id: true } },
} as const

export const eventRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /events ────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createEventSchema.parse(request.body)

    let userId: string
    if (request.auth.user) {
      userId = request.auth.user.id
    } else {
      const newUser = await app.prisma.user.create({
        data: { isAnonymous: true, nickname: generateNickname() },
      })
      userId = newUser.id
    }

    const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null

    // repeatEvery is premium-only; silently ignore at create-time (host can
    // upgrade post-creation and PATCH the field afterwards)
    const event = await app.prisma.event.create({
      data: {
        hostUserId: userId,
        title: body.title,
        description: body.description ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: body.timezone,
        location: body.location ?? null,
        locationLink: body.locationLink ?? null,
        coverPresetId: body.coverPresetId ?? null,
        wishlistId: body.wishlistId ?? null,
        pinHash,
        rsvpVisibility: body.rsvpVisibility,
        remindersEnabled: body.remindersEnabled,
        pollQuestion: body.pollQuestion ?? null,
        pollOptions: body.pollOptions ?? undefined,
      },
      include: EVENT_INCLUDE,
    })

    // Schedule T-24h and T-2h reminders (fire-and-forget; failures logged)
    scheduleEventReminders(app.prisma, event).catch((err) =>
      app.log.error({ err: err.message, eventId: event.id }, '[reminders] schedule failed'),
    )

    reply.status(201)
    return {
      event: formatOwnerEvent(event),
      editToken: request.auth.user ? undefined : event.editToken,
    }
  })

  // ── GET /events/mine ────────────────────────────────────────────────────
  // Must be defined BEFORE /:tokenOrSlug to avoid route collision
  app.get('/mine', async (request) => {
    const user = requireAuth(request)
    const events = await app.prisma.event.findMany({
      where: {
        OR: [
          { hostUserId: user.id },
          { rsvps: { some: { guestUserId: user.id } } },
        ],
      },
      include: EVENT_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return { events: events.map(formatPublicEvent) }
  })

  // ── POST /events/:tokenOrSlug/verify-pin ────────────────────────────────
  app.post('/:tokenOrSlug/verify-pin', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const body = verifyPinSchema.parse(request.body)

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { pinHash: true },
    })

    if (!event || !event.pinHash) return reply.status(404).send({ error: 'Event not found' })

    const ok = await bcrypt.compare(body.pin, event.pinHash)
    return { valid: ok }
  })

  // ── GET /events/:tokenOrSlug ────────────────────────────────────────────
  app.get('/:tokenOrSlug', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const submittedPin = request.headers['x-event-pin'] as string | undefined

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      include: EVENT_INCLUDE,
    })

    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId

    if (event.pinHash && !isHost) {
      if (!submittedPin) {
        return {
          requiresPin: true,
          preview: {
            id: event.id,
            title: event.title,
            coverImageUrl: event.coverImageUrl ?? event.coverPreset?.imageUrl ?? null,
            hostName: event.host.name ?? event.host.nickname,
          },
        }
      }
      const ok = await bcrypt.compare(submittedPin, event.pinHash)
      if (!ok) return reply.status(403).send({ error: 'Неверный PIN' })
    }

    // Track view (idempotent per day per viewer)
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip
    const ua = request.headers['user-agent'] ?? ''
    const day = new Date().toISOString().slice(0, 10)
    const viewerHash = createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex')

    await app.prisma.eventView.upsert({
      where: { eventId_viewerHash: { eventId: event.id, viewerHash } },
      update: {},
      create: { eventId: event.id, viewerHash },
    }).catch(() => { /* ignore tracking errors */ })

    return isHost ? formatOwnerEvent(event) : formatPublicEvent(event)
  })

  // ── PATCH /events/:id ───────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateEventSchema.parse(request.body)

    const event = await app.prisma.event.findUnique({
      where: { id },
      include: { upgrade: { select: { id: true } } },
    })
    if (!event) return reply.status(404).send({ return: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId
    if (!isHost) return reply.status(403).send({ error: 'Access denied' })

    const data: Record<string, unknown> = {}
    if (body.title !== undefined)            data.title = body.title
    if (body.description !== undefined)      data.description = body.description
    if (body.startsAt !== undefined)         data.startsAt = new Date(body.startsAt)
    if (body.endsAt !== undefined)           data.endsAt = body.endsAt ? new Date(body.endsAt) : null
    if (body.timezone !== undefined)         data.timezone = body.timezone
    if (body.location !== undefined)         data.location = body.location
    if (body.locationLink !== undefined)     data.locationLink = body.locationLink
    if (body.coverPresetId !== undefined)    data.coverPresetId = body.coverPresetId
    if (body.wishlistId !== undefined)       data.wishlistId = body.wishlistId
    if (body.rsvpVisibility !== undefined)   data.rsvpVisibility = body.rsvpVisibility
    if (body.remindersEnabled !== undefined) data.remindersEnabled = body.remindersEnabled
    if (body.cancelMessage !== undefined)    data.cancelMessage = body.cancelMessage
    if (body.pollQuestion !== undefined)     data.pollQuestion = body.pollQuestion
    if (body.pollOptions !== undefined)      data.pollOptions = body.pollOptions
    if (body.pin !== undefined) {
      data.pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null
    }

    // repeatEvery — premium-only (auto-clone after end-date)
    if (body.repeatEvery !== undefined) {
      if (body.repeatEvery !== null && !event.upgrade) {
        return reply.status(402).send({
          error: 'Повторение ивента доступно только в премиум',
        })
      }
      data.repeatEvery = body.repeatEvery
    }

    // customSlug — premium-only
    if (body.customSlug !== undefined) {
      if (!event.upgrade) {
        return reply.status(402).send({
          error: 'Кастомный URL доступен только для премиум-ивентов',
        })
      }
      if (body.customSlug !== null) {
        // Check uniqueness explicitly to surface 409 vs P2002
        const existing = await app.prisma.event.findUnique({
          where: { customSlug: body.customSlug },
          select: { id: true },
        })
        if (existing && existing.id !== id) {
          return reply.status(409).send({ error: 'Этот URL уже занят' })
        }
        // Don't allow customSlug that collides with another event's shareToken
        const tokenClash = await app.prisma.event.findUnique({
          where: { shareToken: body.customSlug },
          select: { id: true },
        })
        if (tokenClash && tokenClash.id !== id) {
          return reply.status(409).send({ error: 'Этот URL уже занят' })
        }
      }
      data.customSlug = body.customSlug
    }

    const updated = await app.prisma.event.update({
      where: { id },
      data,
      include: EVENT_INCLUDE,
    })

    await publishEventEvent(app.redis, id, { type: 'event.updated', eventId: id })

    // Re-schedule reminders if startsAt or enabled changed
    if (body.startsAt !== undefined || body.remindersEnabled !== undefined) {
      scheduleEventReminders(app.prisma, updated).catch((err) =>
        app.log.error({ err: err.message, eventId: id }, '[reminders] reschedule failed'),
      )
    }

    // Re-schedule auto-clone if repeatEvery or dates changed
    if (
      body.repeatEvery !== undefined ||
      body.startsAt !== undefined ||
      body.endsAt !== undefined
    ) {
      scheduleAutoClone(app.prisma, updated).catch((err) =>
        app.log.error({ err: err.message, eventId: id }, '[auto-clone] schedule failed'),
      )
    }

    return formatOwnerEvent(updated)
  })

  // ── DELETE /events/:id (soft — status=CANCELLED) ───────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = cancelEventSchema.parse(request.body)

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId
    if (!isHost) return reply.status(403).send({ error: 'Access denied' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED', cancelMessage: body.cancelMessage },
      include: EVENT_INCLUDE,
    })

    await publishEventEvent(app.redis, id, { type: 'event.cancelled', eventId: id })

    // Clear pending reminders for cancelled event
    clearEventReminders(app.prisma, id).catch((err) =>
      app.log.error({ err: err.message, eventId: id }, '[reminders] clear failed'),
    )

    return formatOwnerEvent(updated)
  })

  // ── POST /events/:id/duplicate ──────────────────────────────────────────
  // Clone an existing event into a new one. Caller can provide a new
  // startsAt; everything else copies from the source. Host-only.
  app.post('/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body ?? {}) as {
      startsAt?: string
      title?: string
    }

    const src = await app.prisma.event.findUnique({ where: { id } })
    if (!src) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === src.editToken ||
      request.auth.user?.id === src.hostUserId
    if (!isHost) return reply.status(403).send({ error: 'Access denied' })

    // New event inherits everything except IDs, premium status, slug, PIN
    const newStartsAt = body.startsAt
      ? new Date(body.startsAt)
      : (() => {
          // default: same day next year
          const d = new Date(src.startsAt)
          d.setFullYear(d.getFullYear() + 1)
          return d
        })()

    const newEndsAt = src.endsAt
      ? (() => {
          const diff = src.endsAt.getTime() - src.startsAt.getTime()
          return new Date(newStartsAt.getTime() + diff)
        })()
      : null

    const created = await app.prisma.event.create({
      data: {
        hostUserId: src.hostUserId,
        title: body.title ?? src.title,
        description: src.description,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        timezone: src.timezone,
        location: src.location,
        locationLink: src.locationLink,
        coverImageUrl: src.coverImageUrl,
        coverPresetId: src.coverPresetId,
        wishlistId: src.wishlistId,
        rsvpVisibility: src.rsvpVisibility,
        remindersEnabled: src.remindersEnabled,
        // DO NOT copy: pinHash, customSlug, upgrade, shareToken, editToken
      },
      include: EVENT_INCLUDE,
    })

    // Schedule reminders for the new event
    scheduleEventReminders(app.prisma, created).catch((err) =>
      app.log.error({ err: err.message, eventId: created.id }, '[reminders] schedule failed'),
    )

    reply.status(201)
    return {
      event: formatOwnerEvent(created),
      editToken: request.auth.user ? undefined : created.editToken,
    }
  })

  // ── POST /events/:tokenOrSlug/rsvp ──────────────────────────────────────
  app.post('/:tokenOrSlug/rsvp', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const body = createRsvpSchema.parse(request.body)

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true, status: true, pinHash: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.status === 'CANCELLED') return reply.status(410).send({ error: 'Event cancelled' })

    if (event.pinHash) {
      const pin = request.headers['x-event-pin'] as string | undefined
      const ok = pin ? await bcrypt.compare(pin, event.pinHash) : false
      if (!ok) return reply.status(403).send({ error: 'PIN required' })
    }

    let guestUserId: string
    let cancelToken: string | undefined
    if (request.auth.user) {
      guestUserId = request.auth.user.id
    } else {
      const newUser = await app.prisma.user.create({
        data: {
          isAnonymous: true,
          nickname: body.guestDisplayName ?? generateNickname(),
          name: body.guestDisplayName ?? null,
        },
      })
      guestUserId = newUser.id
      cancelToken = randomBytes(32).toString('hex')
    }

    const cancelTokenHash = cancelToken
      ? createHash('sha256').update(cancelToken).digest('hex')
      : null

    const rsvp = await app.prisma.eventRsvp.upsert({
      where: { eventId_guestUserId: { eventId: event.id, guestUserId } },
      update: {
        status: body.status,
        plusOnes: body.plusOnes,
        message: body.message ?? null,
        pollAnswer: body.pollAnswer ?? null,
      },
      create: {
        eventId: event.id,
        guestUserId,
        status: body.status,
        plusOnes: body.plusOnes,
        message: body.message ?? null,
        pollAnswer: body.pollAnswer ?? null,
        cancelTokenHash,
      },
    })

    await publishEventEvent(app.redis, event.id, {
      type: 'rsvp.upserted',
      eventId: event.id,
      rsvpId: rsvp.id,
      status: rsvp.status,
    })

    return {
      rsvp: {
        status: rsvp.status,
        plusOnes: rsvp.plusOnes,
        message: rsvp.message,
        cancelToken,
      },
    }
  })

  // ── DELETE /events/:tokenOrSlug/rsvp ────────────────────────────────────
  app.delete('/:tokenOrSlug/rsvp', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const cancelToken = request.headers['x-cancel-token'] as string | undefined

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    let rsvpId: string | null = null

    if (request.auth.user) {
      const existing = await app.prisma.eventRsvp.findUnique({
        where: { eventId_guestUserId: { eventId: event.id, guestUserId: request.auth.user.id } },
        select: { id: true },
      })
      rsvpId = existing?.id ?? null
    } else if (cancelToken) {
      const hash = createHash('sha256').update(cancelToken).digest('hex')
      const rsvp = await app.prisma.eventRsvp.findFirst({
        where: { eventId: event.id, cancelTokenHash: hash },
        select: { id: true },
      })
      rsvpId = rsvp?.id ?? null
    } else {
      return reply.status(401).send({ error: 'Auth or cancel token required' })
    }

    if (!rsvpId) return reply.status(404).send({ error: 'RSVP not found' })

    await app.prisma.eventRsvp.delete({ where: { id: rsvpId } })
    await publishEventEvent(app.redis, event.id, {
      type: 'rsvp.deleted',
      eventId: event.id,
      rsvpId,
    })
    reply.status(204)
  })

  // ── GET /events/:tokenOrSlug/guests ─────────────────────────────────────
  app.get('/:tokenOrSlug/guests', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true, hostUserId: true, editToken: true, rsvpVisibility: true, pinHash: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId

    if (event.pinHash && !isHost) {
      const pin = request.headers['x-event-pin'] as string | undefined
      const ok = pin ? await bcrypt.compare(pin, event.pinHash) : false
      if (!ok) return reply.status(403).send({ error: 'PIN required' })
    }

    const rsvps = await app.prisma.eventRsvp.findMany({
      where: { eventId: event.id },
      include: { guest: true },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })

    return {
      guests: formatGuestList(
        rsvps,
        event.rsvpVisibility as 'ALL_GUESTS' | 'HOST_ONLY',
        isHost,
      ),
    }
  })

  // ── GET /events/:tokenOrSlug/ical ───────────────────────────────────────
  app.get('/:tokenOrSlug/ical', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      include: { host: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.pinHash) {
      return reply.status(403).send({ error: 'PIN-protected events cannot be exported' })
    }

    const { buildIcs } = await import('../../utils/event-ical')
    const hostName = event.host.name ?? event.host.nickname ?? 'Host'
    const publicUrl = `${process.env.WEB_URL ?? 'http://localhost:3000'}/e/${event.customSlug ?? event.shareToken}`
    const ics = buildIcs(event, hostName, publicUrl)

    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="${event.customSlug ?? event.shareToken}.ics"`,
      )
      .send(ics)
  })
}
