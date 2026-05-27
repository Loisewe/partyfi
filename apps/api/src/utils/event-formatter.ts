import type { Event, EventCoverPreset, User, Wishlist } from '@wishly/db'
import type {
  PublicEvent,
  OwnerEvent,
  PublicUser,
  PublicGuest,
  RsvpStatus,
  EventStatus,
  RsvpVisibility,
} from '@wishly/shared'

type EventWithRelations = Event & {
  host: User
  coverPreset: EventCoverPreset | null
  wishlist: (Wishlist & { _count: { items: number } }) | null
  rsvps: Array<{ status: string; plusOnes: number }>
  upgrade: { id: string } | null
}

export function formatUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    isAnonymous: user.isAnonymous,
  }
}

export function formatPublicEvent(event: EventWithRelations): PublicEvent {
  const rsvpStats = event.rsvps.reduce(
    (acc, r) => {
      if (r.status === 'GOING')     acc.going++
      if (r.status === 'MAYBE')     acc.maybe++
      if (r.status === 'NOT_GOING') acc.notGoing++
      acc.plusOnesTotal += r.plusOnes
      return acc
    },
    { going: 0, maybe: 0, notGoing: 0, plusOnesTotal: 0 },
  )

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    location: event.location,
    locationLink: event.locationLink,
    coverImageUrl: event.coverImageUrl ?? event.coverPreset?.imageUrl ?? null,
    coverPresetSlug: event.coverPreset?.slug ?? null,
    shareToken: event.shareToken,
    customSlug: event.customSlug,
    status: event.status as EventStatus,
    cancelMessage: event.cancelMessage,
    rsvpVisibility: event.rsvpVisibility as RsvpVisibility,
    hasPinProtection: !!event.pinHash,
    host: formatUser(event.host),
    wishlist: event.wishlist
      ? {
          id: event.wishlist.id,
          name: event.wishlist.name,
          shareToken: event.wishlist.shareToken,
          itemCount: event.wishlist._count.items,
        }
      : null,
    rsvpStats,
    isPremium: !!event.upgrade,
    repeatEvery: ((event as unknown as { repeatEvery?: string | null }).repeatEvery ?? null) as PublicEvent['repeatEvery'],
    pollQuestion: (event as unknown as { pollQuestion?: string | null }).pollQuestion ?? null,
    pollOptions: Array.isArray((event as unknown as { pollOptions?: unknown }).pollOptions)
      ? ((event as unknown as { pollOptions: string[] }).pollOptions)
      : null,
    agenda: Array.isArray((event as unknown as { agenda?: unknown }).agenda)
      ? ((event as unknown as { agenda: PublicEvent['agenda'] }).agenda)
      : null,
    createdAt: event.createdAt.toISOString(),
  }
}

export function formatOwnerEvent(event: EventWithRelations): OwnerEvent {
  return {
    ...formatPublicEvent(event),
    editToken: event.editToken,
  }
}

export function formatGuestList(
  rsvps: Array<{
    id: string
    status: string
    plusOnes: number
    message: string | null
    updatedAt: Date
    guest: User
  }>,
  visibility: RsvpVisibility,
  isHost: boolean,
): PublicGuest[] {
  if (visibility === 'HOST_ONLY' && !isHost) return []

  return rsvps.map((r) => ({
    id: r.id,
    status: r.status as RsvpStatus,
    plusOnes: r.plusOnes,
    message: r.message,
    guest: formatUser(r.guest),
    respondedAt: r.updatedAt.toISOString(),
  }))
}
