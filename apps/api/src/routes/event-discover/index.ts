import type { FastifyPluginAsync } from 'fastify'

/**
 * Public /discover feed — events that hosts opted-in via isDiscoverable=true.
 *
 * Hard filters:
 *   - status = ACTIVE
 *   - startsAt > now (future events only)
 *   - isDiscoverable = true
 *
 * Privacy: returns only display fields. No exact location (city-level only),
 * no guest list, no editToken.
 *
 * Query params:
 *   - city: filter by discoveryCity (case-insensitive contains)
 *   - cursor: createdAt timestamp for pagination
 *   - limit: max 24, default 12
 */
export const eventDiscoverRoutes: FastifyPluginAsync = async (app) => {
  app.get('/discover', async (request) => {
    const query = request.query as { city?: string; cursor?: string; limit?: string }
    const limit = Math.min(24, Math.max(1, parseInt(query.limit ?? '12', 10) || 12))

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      isDiscoverable: true,
      startsAt: { gt: new Date() },
    }
    if (query.city) {
      where.discoveryCity = { contains: query.city, mode: 'insensitive' }
    }
    if (query.cursor) {
      const cursorDate = new Date(query.cursor)
      if (!isNaN(cursorDate.getTime())) {
        where.startsAt = { gt: cursorDate }
      }
    }

    const events = await app.prisma.event.findMany({
      where,
      take: limit + 1,
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        shareToken: true,
        customSlug: true,
        coverImageUrl: true,
        coverPreset: { select: { slug: true, imageUrl: true } },
        themeColor: true,
        discoveryCity: true,
        rsvps: { where: { status: 'GOING' }, select: { plusOnes: true } },
        host: { select: { name: true, nickname: true } },
      },
    })

    const hasMore = events.length > limit
    const items = events.slice(0, limit).map((e) => ({
      slug: e.customSlug ?? e.shareToken,
      title: e.title,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
      coverImageUrl: e.coverImageUrl ?? e.coverPreset?.imageUrl ?? null,
      coverPresetSlug: e.coverPreset?.slug ?? null,
      themeColor: e.themeColor,
      city: e.discoveryCity,
      hostName: e.host.name ?? e.host.nickname ?? 'Аноним',
      goingCount: e.rsvps.length + e.rsvps.reduce((acc, r) => acc + r.plusOnes, 0),
    }))

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.startsAt ?? null : null,
    }
  })
}
