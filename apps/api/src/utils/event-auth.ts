import type { PrismaClient } from '@prisma/client'
import type { FastifyRequest } from 'fastify'

export type HostAccess = 'host' | 'co-host' | null

/**
 * Determine the caller's relationship to an event.
 *
 * 'host'    — primary host (created the event)
 * 'co-host' — accepted ACTIVE co-host (full edit rights minus host transfer)
 * null      — no edit access
 */
export async function checkHostAccess(
  prisma: PrismaClient,
  event: { id: string; editToken: string; hostUserId: string },
  request: FastifyRequest,
): Promise<HostAccess> {
  // editToken bearer (anonymous host) is always primary host
  if (request.auth.editToken === event.editToken) return 'host'

  const userId = request.auth.user?.id
  if (!userId) return null

  if (userId === event.hostUserId) return 'host'

  const coHost = await prisma.eventCoHost.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
    select: { status: true },
  })
  if (coHost && coHost.status === 'ACTIVE') return 'co-host'

  return null
}
