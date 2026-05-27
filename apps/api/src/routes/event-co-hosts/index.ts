import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'crypto'
import { requireAuth } from '../../plugins/auth'
import { checkHostAccess } from '../../utils/event-auth'

/**
 * Co-host invite + management routes.
 *
 * Flow:
 *   1. Primary host calls POST /events/:id/co-hosts → server creates PENDING
 *      EventCoHost row with random inviteToken (no userId yet — anyone with
 *      the link can accept). Returns invite URL.
 *   2. Invitee opens URL → must be authenticated → POST /co-host-invites/:token/accept
 *      attaches their userId and flips to ACTIVE.
 *   3. Primary host can DELETE /events/:id/co-hosts/:userId → status REVOKED.
 *
 * Co-hosts cannot manage other co-hosts; only the primary host can.
 */
export const eventCoHostRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /events/:id/co-hosts ────────────────────────────────────────────
  // Primary host creates an invite link.
  app.post('/events/:id/co-hosts', async (request, reply) => {
    const { id: eventId } = request.params as { id: string }
    const event = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const access = await checkHostAccess(app.prisma, event, request)
    if (access !== 'host') {
      return reply.status(403).send({ error: 'Only primary host can invite co-hosts' })
    }

    const inviteToken = randomBytes(24).toString('base64url')

    const row = await app.prisma.eventCoHost.create({
      data: {
        eventId,
        // Pending invite: userId placeholder is the primary host's id; flipped on accept
        userId: event.hostUserId,
        invitedBy: event.hostUserId,
        status: 'PENDING',
        inviteToken,
      },
    })

    const base = process.env.WEB_URL ?? 'http://localhost:3000'
    return {
      invite: {
        id: row.id,
        token: inviteToken,
        url: `${base}/co-host/${inviteToken}`,
      },
    }
  })

  // ── GET /events/:id/co-hosts ─────────────────────────────────────────────
  // List active co-hosts (host or co-host can view).
  app.get('/events/:id/co-hosts', async (request, reply) => {
    const { id: eventId } = request.params as { id: string }
    const event = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const access = await checkHostAccess(app.prisma, event, request)
    if (!access) return reply.status(403).send({ error: 'Access denied' })

    const rows = await app.prisma.eventCoHost.findMany({
      where: { eventId, status: { in: ['PENDING', 'ACTIVE'] } },
      include: { user: { select: { id: true, name: true, nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return {
      coHosts: rows.map((r) => ({
        id: r.id,
        status: r.status,
        addedAt: r.createdAt.toISOString(),
        user: r.status === 'ACTIVE' ? {
          id: r.user.id,
          name: r.user.name,
          nickname: r.user.nickname,
          avatarUrl: r.user.avatarUrl,
        } : null,
        // Only host sees the inviteToken
        inviteToken: access === 'host' && r.status === 'PENDING' ? r.inviteToken : null,
      })),
    }
  })

  // ── DELETE /events/:id/co-hosts/:coHostId ────────────────────────────────
  app.delete('/events/:id/co-hosts/:coHostId', async (request, reply) => {
    const { id: eventId, coHostId } = request.params as { id: string; coHostId: string }
    const event = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const access = await checkHostAccess(app.prisma, event, request)
    if (access !== 'host') {
      return reply.status(403).send({ error: 'Only primary host can revoke co-hosts' })
    }

    await app.prisma.eventCoHost.update({
      where: { id: coHostId },
      data: { status: 'REVOKED', inviteToken: null },
    })

    reply.status(204)
  })

  // ── POST /co-host-invites/:token/accept ──────────────────────────────────
  // Invitee accepts (must be authenticated).
  app.post('/co-host-invites/:token/accept', async (request, reply) => {
    const user = requireAuth(request)
    const { token } = request.params as { token: string }

    const invite = await app.prisma.eventCoHost.findUnique({
      where: { inviteToken: token },
      include: { event: { select: { id: true, title: true, hostUserId: true } } },
    })
    if (!invite) return reply.status(404).send({ error: 'Invite not found' })
    if (invite.status !== 'PENDING') {
      return reply.status(409).send({ error: 'Invite already used' })
    }

    if (invite.event.hostUserId === user.id) {
      return reply.status(409).send({ error: 'Ты и так хост этого ивента' })
    }

    // Check user not already co-host of this event
    const existing = await app.prisma.eventCoHost.findUnique({
      where: { eventId_userId: { eventId: invite.event.id, userId: user.id } },
    })
    if (existing && existing.status === 'ACTIVE') {
      return reply.status(409).send({ error: 'Ты уже co-host этого ивента' })
    }

    // Replace placeholder userId with the real accepter; flip to ACTIVE
    const updated = await app.prisma.eventCoHost.update({
      where: { id: invite.id },
      data: {
        userId: user.id,
        status: 'ACTIVE',
        inviteToken: null, // burn token
      },
    })

    return {
      coHost: {
        id: updated.id,
        eventId: invite.event.id,
        eventTitle: invite.event.title,
        status: updated.status,
      },
    }
  })

  // ── GET /co-host-invites/:token ──────────────────────────────────────────
  // Preview the invite (event title + host) before accepting.
  app.get('/co-host-invites/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const invite = await app.prisma.eventCoHost.findUnique({
      where: { inviteToken: token },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            host: { select: { name: true, nickname: true } },
            coverPreset: { select: { slug: true } },
          },
        },
      },
    })
    if (!invite) return reply.status(404).send({ error: 'Invite not found' })
    if (invite.status !== 'PENDING') {
      return reply.status(410).send({ error: 'Invite already used or revoked' })
    }

    return {
      preview: {
        eventTitle: invite.event.title,
        eventStartsAt: invite.event.startsAt.toISOString(),
        hostName: invite.event.host.name ?? invite.event.host.nickname ?? 'хост',
        coverPresetSlug: invite.event.coverPreset?.slug ?? null,
      },
    }
  })
}
