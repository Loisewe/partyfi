import type { PrismaClient, EventRsvp } from '@prisma/client'

/**
 * Push a Telegram DM to the event host when a guest RSVPs.
 *
 * Skips silently when:
 *   - TELEGRAM_BOT_TOKEN is not set
 *   - Host has no telegramId
 *   - Guest IS the host (self-RSVP)
 *   - Host has muted DM notifications (future feature — Settings.dmOnNewRsvp)
 */
export async function notifyHostOnRsvp(
  prisma: PrismaClient,
  rsvp: Pick<EventRsvp, 'eventId' | 'guestUserId' | 'status' | 'plusOnes'>,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  const event = await prisma.event.findUnique({
    where: { id: rsvp.eventId },
    select: {
      id: true,
      title: true,
      shareToken: true,
      hostUserId: true,
      host: { select: { telegramId: true } },
    },
  })
  if (!event) return
  if (!event.host.telegramId) return
  if (event.hostUserId === rsvp.guestUserId) return

  const guest = await prisma.user.findUnique({
    where: { id: rsvp.guestUserId },
    select: { name: true, nickname: true },
  })
  const guestName = guest?.name ?? guest?.nickname ?? 'Гость'

  const verb =
    rsvp.status === 'GOING' ? 'идёт' :
    rsvp.status === 'MAYBE' ? 'может быть' :
    'не сможет'
  const emoji =
    rsvp.status === 'GOING' ? '🎉' :
    rsvp.status === 'MAYBE' ? '🤔' :
    '😔'
  const plusOnesNote = rsvp.plusOnes > 0 ? ` (+${rsvp.plusOnes})` : ''

  const webBase = process.env.WEB_URL ?? 'http://localhost:3000'
  const text = [
    `${emoji} <b>${guestName}</b>${plusOnesNote} ${verb}`,
    `на «${event.title}»`,
    ``,
    `Дашборд: ${webBase}/e/${event.shareToken}/host`,
  ].join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: event.host.telegramId,
        text,
        parse_mode: 'HTML',
        disable_notification: false,
      }),
    })
  } catch {
    // best-effort, swallow
  }
}
