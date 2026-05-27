import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import type { PrismaClient, Event, EventReminder } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

/**
 * Event reminders subsystem.
 *
 * Schedules T-24h and T-2h reminders for each event with `remindersEnabled = true`.
 * A worker picks up due jobs and (a) pushes a Telegram message to each GOING RSVP'd
 * user if `TELEGRAM_BOT_TOKEN` is set, and (b) marks the EventReminder.sentAt.
 *
 * Without a bot token the worker logs the would-be push and still marks sentAt.
 */

const QUEUE_NAME = 'event-reminders'

interface ReminderJobData {
  eventId: string
  reminderId: string
  kind: 'T_24H' | 'T_2H' | 'CUSTOM'
}

let queue: Queue<ReminderJobData> | null = null
let worker: Worker<ReminderJobData> | null = null

function createConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  })
}

export function getRemindersQueue(): Queue<ReminderJobData> {
  if (!queue) {
    queue = new Queue<ReminderJobData>(QUEUE_NAME, { connection: createConnection() })
  }
  return queue
}

/**
 * Schedule (or re-schedule) reminders for an event.
 * Idempotent: removes existing pending reminders before creating new ones.
 */
export async function scheduleEventReminders(
  prisma: PrismaClient,
  event: Pick<Event, 'id' | 'startsAt' | 'remindersEnabled' | 'status'>,
): Promise<void> {
  // Clear existing pending reminders + queue jobs for this event
  await clearEventReminders(prisma, event.id)

  if (!event.remindersEnabled || event.status !== 'ACTIVE') return

  const startsAt = new Date(event.startsAt)
  const now = new Date()

  const slots: Array<{ kind: 'T_24H' | 'T_2H'; triggerAt: Date }> = [
    { kind: 'T_24H', triggerAt: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000) },
    { kind: 'T_2H',  triggerAt: new Date(startsAt.getTime() -  2 * 60 * 60 * 1000) },
  ]

  for (const slot of slots) {
    if (slot.triggerAt <= now) continue

    const reminder = await prisma.eventReminder.create({
      data: {
        eventId: event.id,
        triggerAt: slot.triggerAt,
        kind: slot.kind,
      },
    })

    const delayMs = slot.triggerAt.getTime() - now.getTime()
    await getRemindersQueue().add(
      `${event.id}-${slot.kind}`,
      { eventId: event.id, reminderId: reminder.id, kind: slot.kind },
      { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    )
  }
}

export async function clearEventReminders(prisma: PrismaClient, eventId: string): Promise<void> {
  const pending = await prisma.eventReminder.findMany({
    where: { eventId, sentAt: null },
    select: { id: true },
  })

  // Remove queue jobs (best effort)
  const q = getRemindersQueue()
  for (const r of pending) {
    try {
      const job = await q.getJob(`${eventId}-T_24H`)
      if (job) await job.remove()
    } catch {}
    try {
      const job = await q.getJob(`${eventId}-T_2H`)
      if (job) await job.remove()
    } catch {}
  }

  // Wipe pending DB records — they'll be recreated by scheduleEventReminders
  await prisma.eventReminder.deleteMany({
    where: { eventId, sentAt: null },
  })
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log(`[reminders] WOULD push to chat=${chatId}: ${text}`)
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch (err) {
    console.error(`[reminders] TG send failed:`, err)
    return false
  }
}

function formatReminderText(
  event: Pick<Event, 'title' | 'startsAt' | 'location' | 'shareToken'>,
  kind: 'T_24H' | 'T_2H' | 'CUSTOM',
  webBase: string,
): string {
  const when = kind === 'T_24H' ? 'завтра' : kind === 'T_2H' ? 'через 2 часа' : 'скоро'
  const timeStr = new Date(event.startsAt).toLocaleString('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const url = `${webBase}/e/${event.shareToken}`
  return [
    `🎉 <b>${event.title}</b> — ${when}!`,
    ``,
    `🗓 ${timeStr}`,
    event.location ? `📍 ${event.location}` : null,
    ``,
    `Открыть: ${url}`,
  ].filter(Boolean).join('\n')
}

export function startRemindersWorker(prisma: PrismaClient, app: FastifyInstance): void {
  if (worker) return

  const webBase = process.env.WEB_URL ?? 'http://localhost:3000'

  worker = new Worker<ReminderJobData>(
    QUEUE_NAME,
    async (job) => {
      const { eventId, reminderId, kind } = job.data

      const reminder = await prisma.eventReminder.findUnique({
        where: { id: reminderId },
        include: { event: { include: { rsvps: { where: { status: 'GOING' }, include: { guest: true } } } } },
      })

      if (!reminder || reminder.sentAt) return
      const event = reminder.event
      if (!event || event.status !== 'ACTIVE') return

      const text = formatReminderText(event, kind, webBase)

      let pushed = 0
      let skipped = 0
      for (const rsvp of event.rsvps) {
        const tgId = rsvp.guest.telegramId
        if (!tgId) {
          skipped++
          continue
        }
        const ok = await sendTelegramMessage(tgId, text)
        if (ok) pushed++ ; else skipped++
      }

      await prisma.eventReminder.update({
        where: { id: reminderId },
        data: { sentAt: new Date() },
      })

      app.log.info({ eventId, kind, pushed, skipped }, '[reminders] processed')
    },
    { connection: createConnection() },
  )

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err: err.message }, '[reminders] job failed')
  })

  app.log.info('[reminders] worker started')

  app.addHook('onClose', async () => {
    await worker?.close()
    await queue?.close()
  })
}
