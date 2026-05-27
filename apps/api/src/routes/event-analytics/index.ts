import type { FastifyPluginAsync } from 'fastify'
import { checkHostAccess } from '../../utils/event-auth'

/**
 * GET /events/:id/analytics — host & co-host dashboard data.
 *
 * Returns aggregated metrics from EventView, EventRsvp, EventPhoto.
 * Premium-gated: free events get last-7-days only; premium get full history.
 */
export const eventAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/events/:id/analytics', async (request, reply) => {
    const { id: eventId } = request.params as { id: string }
    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { upgrade: { select: { id: true } } },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const access = await checkHostAccess(app.prisma, event, request)
    if (!access) return reply.status(403).send({ error: 'Access denied' })

    const isPremium = !!event.upgrade
    const now = Date.now()
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

    // Aggregate views — premium gets full history, free gets last 7 days
    const viewsWhere = isPremium
      ? { eventId }
      : { eventId, createdAt: { gte: new Date(now - SEVEN_DAYS) } }

    const [views, rsvps, photos] = await Promise.all([
      app.prisma.eventView.findMany({
        where: viewsWhere,
        select: { createdAt: true, viewerHash: true },
        orderBy: { createdAt: 'asc' },
      }),
      app.prisma.eventRsvp.findMany({
        where: { eventId },
        select: {
          status: true,
          plusOnes: true,
          pollAnswer: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      app.prisma.eventPhoto.count({ where: { eventId } }),
    ])

    // Views by day (YYYY-MM-DD bucket)
    const viewsByDay = new Map<string, number>()
    for (const v of views) {
      const day = v.createdAt.toISOString().slice(0, 10)
      viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + 1)
    }

    // Unique viewers (distinct viewerHash)
    const uniqueViewers = new Set(views.map((v) => v.viewerHash)).size

    // RSVP funnel: total views → unique viewers → people who RSVP'd → going
    const totalRsvps = rsvps.length
    const goingRsvps = rsvps.filter((r) => r.status === 'GOING').length
    const conversionViewToRsvp = uniqueViewers > 0 ? totalRsvps / uniqueViewers : 0

    // RSVPs by day
    const rsvpsByDay = new Map<string, { going: number; maybe: number; notGoing: number }>()
    for (const r of rsvps) {
      const day = r.updatedAt.toISOString().slice(0, 10)
      const entry = rsvpsByDay.get(day) ?? { going: 0, maybe: 0, notGoing: 0 }
      if (r.status === 'GOING') entry.going++
      else if (r.status === 'MAYBE') entry.maybe++
      else entry.notGoing++
      rsvpsByDay.set(day, entry)
    }

    // Poll breakdown (if event has a poll)
    const pollBreakdown: Record<string, number> = {}
    if ((event as { pollQuestion?: string | null }).pollQuestion) {
      for (const r of rsvps) {
        if (r.pollAnswer) {
          pollBreakdown[r.pollAnswer] = (pollBreakdown[r.pollAnswer] ?? 0) + 1
        }
      }
    }

    // Time-to-first-RSVP (median): minutes from view to first RSVP per viewer
    // Skipped for MVP — needs more data correlation

    return {
      isPremium,
      isLimitedByFreeTier: !isPremium,
      summary: {
        totalViews: views.length,
        uniqueViewers,
        totalRsvps,
        goingRsvps,
        plusOnesTotal: rsvps.reduce((acc, r) => acc + (r.status === 'GOING' ? r.plusOnes : 0), 0),
        photoCount: photos,
        conversionViewToRsvp,
      },
      viewsByDay: Array.from(viewsByDay.entries()).map(([day, count]) => ({ day, count })),
      rsvpsByDay: Array.from(rsvpsByDay.entries()).map(([day, counts]) => ({ day, ...counts })),
      pollBreakdown: Object.entries(pollBreakdown).map(([option, count]) => ({ option, count })),
    }
  })
}
