import type { FastifyPluginAsync } from 'fastify'

export const eventCoverPresetRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /event-cover-presets ────────────────────────────────────────────
  // Public list of cover presets. Optional ?occasion=birthday filters by tag.
  app.get('/', async (request) => {
    const query = request.query as { occasion?: string }
    const tag = query.occasion?.toLowerCase()

    const where = tag ? { occasionTags: { has: tag } } : {}

    const presets = await app.prisma.eventCoverPreset.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        imageUrl: true,
        occasionTags: true,
      },
    })

    return { presets }
  })
}
