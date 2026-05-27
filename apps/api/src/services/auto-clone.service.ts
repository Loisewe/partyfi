import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { PrismaClient, Event } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { scheduleEventReminders } from './reminders.service'

/**
 * Auto-clone subsystem for recurring events.
 *
 * When event.repeatEvery is set, we schedule a BullMQ job to fire 1 minute
 * after the event's end-date (or startsAt + 6h if no endsAt). On fire, the
 * worker duplicates the event with the next-cadence startsAt and re-schedules
 * its own auto-clone (if repeatEvery still set on the new event — which it
 * isn't by default, but premium hosts may opt-in).
 *
 * To avoid runaway loops, the worker only clones if the source is still
 * marked ACTIVE.
 */

const QUEUE_NAME = 'event-auto-clone'

interface AutoCloneJob {
  eventId: string
}

let queue: Queue<AutoCloneJob> | null = null
let worker: Worker<AutoCloneJob> | null = null

function createConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  })
}

function getQueue(): Queue<AutoCloneJob> {
  if (!queue) queue = new Queue<AutoCloneJob>(QUEUE_NAME, { connection: createConnection() })
  return queue
}

function nextStartsAt(src: Event, cadence: 'WEEKLY' | 'MONTHLY' | 'YEARLY'): Date {
  const d = new Date(src.startsAt)
  switch (cadence) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7)
      break
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1)
      break
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d
}

/** Schedule the auto-clone job for an event. Idempotent: removes any existing job first. */
export async function scheduleAutoClone(prisma: PrismaClient, event: Event): Promise<void> {
  const cadence = (event as unknown as { repeatEvery?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null }).repeatEvery
  // Always clear stale job first
  const jobId = `${event.id}-auto-clone`
  try {
    const existing = await getQueue().getJob(jobId)
    if (existing) await existing.remove()
  } catch {}

  if (!cadence || event.status !== 'ACTIVE') return

  // Default trigger: 1 minute after endsAt; or startsAt + 6h if no endsAt
  const triggerAt = event.endsAt
    ? new Date(event.endsAt.getTime() + 60_000)
    : new Date(event.startsAt.getTime() + 6 * 60 * 60_000)

  const delayMs = triggerAt.getTime() - Date.now()
  if (delayMs <= 0) return // Already past — skip silently (run a one-off cleanup later if needed)

  await getQueue().add(
    jobId,
    { eventId: event.id },
    { jobId, delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  )
}

const EVENT_CLONE_INCLUDE = {
  host: true,
  coverPreset: true,
  wishlist: { include: { _count: { select: { items: true } } } },
  rsvps: { select: { status: true, plusOnes: true } },
  upgrade: { select: { id: true } },
} as const

export function startAutoCloneWorker(prisma: PrismaClient, app: FastifyInstance): void {
  if (worker) return

  worker = new Worker<AutoCloneJob>(
    QUEUE_NAME,
    async (job) => {
      const { eventId } = job.data
      const src = await prisma.event.findUnique({ where: { id: eventId } })
      if (!src) return
      const cadence = (src as unknown as { repeatEvery?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null }).repeatEvery
      if (!cadence) return
      if (src.status !== 'ACTIVE') return

      const newStartsAt = nextStartsAt(src, cadence)
      const newEndsAt = src.endsAt
        ? new Date(newStartsAt.getTime() + (src.endsAt.getTime() - src.startsAt.getTime()))
        : null

      const cloned = await prisma.event.create({
        data: {
          hostUserId: src.hostUserId,
          title: src.title,
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
          // Cadence preserved on the clone — chain continues
          ...({ repeatEvery: cadence, repeatParentId: src.id } as Record<string, unknown>),
          // pollQuestion / pollOptions are reset (poll feedback should restart fresh)
        },
        include: EVENT_CLONE_INCLUDE,
      })

      await scheduleEventReminders(prisma, cloned)
      await scheduleAutoClone(prisma, cloned)

      app.log.info({ srcId: src.id, newId: cloned.id, cadence, newStartsAt }, '[auto-clone] event cloned')
    },
    { connection: createConnection() },
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err: err.message }, '[auto-clone] job failed')
  })

  app.log.info('[auto-clone] worker started')

  app.addHook('onClose', async () => {
    await worker?.close()
    await queue?.close()
  })
}
