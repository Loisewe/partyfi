import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'crypto'
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@wishly/shared'
import { requireAuth } from '../../plugins/auth'
import { getOrgRole, hasOrgRole } from '../../utils/org-auth'

/** Reserved slugs we never let users grab — collide with routes. */
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'create-event', 'dashboard', 'discover',
  'docs', 'e', 'embed', 'health', 'o', 'og', 'pricing', 'privacy',
  'settings', 'signup', 'signin', 'tg', 'terms', 'uploads', 'w',
])

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /organizations — create new (auth required) ────────────────────
  app.post('/', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const user = requireAuth(request)
    const body = createOrgSchema.parse(request.body)

    if (RESERVED_SLUGS.has(body.slug)) {
      return reply.status(409).send({ error: 'Этот URL зарезервирован' })
    }
    const exists = await app.prisma.organization.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    })
    if (exists) return reply.status(409).send({ error: 'Этот URL уже занят' })

    const org = await app.prisma.organization.create({
      data: {
        slug: body.slug,
        name: body.name,
        tagline: body.tagline ?? null,
        description: body.description ?? null,
        ownerUserId: user.id,
        subscription: {
          create: { plan: 'FREE' },
        },
      },
      include: { subscription: true },
    })

    reply.status(201)
    return { organization: formatOrg(org) }
  })

  // ── GET /organizations/mine — list orgs the caller belongs to ───────────
  app.get('/mine', async (request) => {
    const user = requireAuth(request)

    const [owned, memberOf] = await Promise.all([
      app.prisma.organization.findMany({
        where: { ownerUserId: user.id },
        include: { subscription: true },
        orderBy: { updatedAt: 'desc' },
      }),
      app.prisma.organizationMember.findMany({
        where: { userId: user.id, acceptedAt: { not: null } },
        include: { organization: { include: { subscription: true } } },
      }),
    ])

    type WithRole = ReturnType<typeof formatOrg> & { role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' }
    const merged = new Map<string, WithRole>()
    for (const o of owned) merged.set(o.id, { ...formatOrg(o), role: 'OWNER' })
    for (const m of memberOf) {
      if (!merged.has(m.organization.id)) {
        merged.set(m.organization.id, { ...formatOrg(m.organization), role: m.role })
      }
    }
    return { organizations: Array.from(merged.values()) }
  })

  // ── GET /organizations/:slug — public + admin combined ──────────────────
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const org = await app.prisma.organization.findUnique({
      where: { slug },
      include: {
        subscription: true,
        owner: { select: { name: true, nickname: true, avatarUrl: true } },
      },
    })
    if (!org) return reply.status(404).send({ error: 'Organization not found' })

    const role = await getOrgRole(app.prisma, org.id, request.auth.user?.id)
    return {
      organization: formatOrg(org),
      owner: {
        name: org.owner.name ?? org.owner.nickname,
        avatarUrl: org.owner.avatarUrl,
      },
      callerRole: role,
    }
  })

  // ── PATCH /organizations/:id — admin update (brand, description, etc.) ──
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getOrgRole(app.prisma, id, request.auth.user?.id)
    if (!hasOrgRole(role, 'ADMIN')) {
      return reply.status(403).send({ error: 'Только админы могут править организацию' })
    }
    const body = updateOrgSchema.parse(request.body)

    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) if (v !== undefined) data[k] = v

    const updated = await app.prisma.organization.update({
      where: { id },
      data,
      include: { subscription: true },
    })
    return { organization: formatOrg(updated) }
  })

  // ── GET /organizations/:slug/events ────────────────────────────────────
  // Public lineup of upcoming + recently-past events. Cancelled events hidden.
  app.get('/:slug/events', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const query = request.query as { tense?: 'upcoming' | 'past'; limit?: string }
    const tense = query.tense ?? 'upcoming'
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 60)

    const org = await app.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!org) return reply.status(404).send({ error: 'Organization not found' })

    const now = new Date()
    const events = await app.prisma.event.findMany({
      where: {
        organizationId: org.id,
        status: 'ACTIVE',
        startsAt: tense === 'upcoming' ? { gte: now } : { lt: now },
      },
      orderBy: { startsAt: tense === 'upcoming' ? 'asc' : 'desc' },
      take: limit,
      include: {
        rsvps: { select: { status: true, plusOnes: true } },
        upgrade: { select: { id: true } },
      },
    })

    return {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        shareToken: e.shareToken,
        customSlug: e.customSlug,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() ?? null,
        location: e.location,
        coverImageUrl: e.coverImageUrl,
        themeColor: e.themeColor,
        isPremium: !!e.upgrade,
        rsvpStats: {
          going: e.rsvps.filter((r) => r.status === 'GOING').length,
          plusOnesTotal: e.rsvps
            .filter((r) => r.status === 'GOING')
            .reduce((s, r) => s + r.plusOnes, 0),
        },
      })),
    }
  })

  // ── GET /organizations/:id/members — admin list ────────────────────────
  app.get('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getOrgRole(app.prisma, id, request.auth.user?.id)
    if (!hasOrgRole(role, 'EDITOR')) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const members = await app.prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: { user: { select: { id: true, name: true, nickname: true, avatarUrl: true } } },
      orderBy: { invitedAt: 'asc' },
    })

    return {
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
        invitedAt: m.invitedAt.toISOString(),
        acceptedAt: m.acceptedAt?.toISOString() ?? null,
        inviteToken: hasOrgRole(role, 'ADMIN') && !m.acceptedAt ? m.inviteToken : null,
      })),
    }
  })

  // ── POST /organizations/:id/members — invite ────────────────────────────
  app.post('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string }
    const role = await getOrgRole(app.prisma, id, request.auth.user?.id)
    if (!hasOrgRole(role, 'ADMIN')) {
      return reply.status(403).send({ error: 'Только админы могут приглашать' })
    }
    const body = inviteMemberSchema.parse(request.body)
    const caller = requireAuth(request)

    if (body.userId) {
      // Direct add — only if user exists and not already a member
      const existing = await app.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: id, userId: body.userId } },
      })
      if (existing) return reply.status(409).send({ error: 'Уже участник' })

      const created = await app.prisma.organizationMember.create({
        data: {
          organizationId: id,
          userId: body.userId,
          role: body.role,
          invitedBy: caller.id,
          acceptedAt: new Date(),  // direct add is implicitly accepted
        },
      })
      return { member: { id: created.id, role: created.role } }
    }

    // Generate invite link — placeholder userId is the inviter
    const inviteToken = randomBytes(24).toString('base64url')
    const row = await app.prisma.organizationMember.create({
      data: {
        organizationId: id,
        userId: caller.id,  // placeholder, replaced on accept
        role: body.role,
        invitedBy: caller.id,
        inviteToken,
        acceptedAt: null,
      },
    })

    const base = process.env.WEB_URL ?? 'http://localhost:3000'
    return {
      invite: {
        id: row.id,
        token: inviteToken,
        url: `${base}/o-invite/${inviteToken}`,
      },
    }
  })

  // ── POST /organizations/invites/:token/accept ──────────────────────────
  app.post('/invites/:token/accept', async (request, reply) => {
    const user = requireAuth(request)
    const { token } = request.params as { token: string }

    const invite = await app.prisma.organizationMember.findUnique({
      where: { inviteToken: token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    })
    if (!invite) return reply.status(404).send({ error: 'Invite not found' })
    if (invite.acceptedAt) return reply.status(409).send({ error: 'Уже использовано' })

    // Check user not already a member of this org
    const existing = await app.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: invite.organization.id, userId: user.id } },
    })
    if (existing && existing.acceptedAt) {
      return reply.status(409).send({ error: 'Ты уже участник этой организации' })
    }

    const updated = await app.prisma.organizationMember.update({
      where: { id: invite.id },
      data: { userId: user.id, acceptedAt: new Date(), inviteToken: null },
    })
    return {
      member: { id: updated.id, role: updated.role },
      org: { slug: invite.organization.slug, name: invite.organization.name },
    }
  })

  // ── DELETE /organizations/:id/members/:memberId ─────────────────────────
  app.delete('/:id/members/:memberId', async (request, reply) => {
    const { id, memberId } = request.params as { id: string; memberId: string }
    const role = await getOrgRole(app.prisma, id, request.auth.user?.id)
    if (!hasOrgRole(role, 'ADMIN')) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const target = await app.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { organization: { select: { ownerUserId: true } } },
    })
    if (!target || target.organizationId !== id) {
      return reply.status(404).send({ error: 'Member not found' })
    }
    if (target.userId === target.organization.ownerUserId) {
      return reply.status(409).send({ error: 'Нельзя удалить владельца' })
    }

    await app.prisma.organizationMember.delete({ where: { id: memberId } })
    reply.status(204)
  })

  // ── PATCH /organizations/:id/members/:memberId — change role ────────────
  app.patch('/:id/members/:memberId', async (request, reply) => {
    const { id, memberId } = request.params as { id: string; memberId: string }
    const role = await getOrgRole(app.prisma, id, request.auth.user?.id)
    if (!hasOrgRole(role, 'ADMIN')) {
      return reply.status(403).send({ error: 'Access denied' })
    }
    const body = updateMemberRoleSchema.parse(request.body)

    const updated = await app.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: body.role },
    })
    return { member: { id: updated.id, role: updated.role } }
  })
}

function formatOrg(org: {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  logoUrl: string | null
  brandColor: string | null
  accentColor: string | null
  fontFamily: string | null
  coverImageUrl: string | null
  websiteUrl: string | null
  telegramHandle: string | null
  instagramHandle: string | null
  contactEmail: string | null
  isPublic: boolean
  city: string | null
  ownerUserId: string
  createdAt: Date
  subscription?: { plan: string; expiresAt: Date | null } | null
}) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    tagline: org.tagline,
    description: org.description,
    logoUrl: org.logoUrl,
    coverImageUrl: org.coverImageUrl,
    brandColor: org.brandColor,
    accentColor: org.accentColor,
    fontFamily: org.fontFamily,
    websiteUrl: org.websiteUrl,
    telegramHandle: org.telegramHandle,
    instagramHandle: org.instagramHandle,
    contactEmail: org.contactEmail,
    isPublic: org.isPublic,
    city: org.city,
    ownerUserId: org.ownerUserId,
    createdAt: org.createdAt.toISOString(),
    plan: org.subscription?.plan ?? 'FREE',
    planExpiresAt: org.subscription?.expiresAt?.toISOString() ?? null,
  }
}
