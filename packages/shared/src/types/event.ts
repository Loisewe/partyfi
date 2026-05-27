import type { PublicUser } from './user'

export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING'
export type EventStatus = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED'
export type RsvpVisibility = 'ALL_GUESTS' | 'HOST_ONLY'

export interface EventRsvpStats {
  going: number
  maybe: number
  notGoing: number
  plusOnesTotal: number
}

export interface PublicEvent {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  timezone: string
  location: string | null
  locationLink: string | null
  coverImageUrl: string | null
  coverPresetSlug: string | null
  shareToken: string
  customSlug: string | null
  status: EventStatus
  cancelMessage: string | null
  rsvpVisibility: RsvpVisibility
  hasPinProtection: boolean
  host: PublicUser
  wishlist: {
    id: string
    name: string
    shareToken: string
    itemCount: number
  } | null
  rsvpStats: EventRsvpStats
  isPremium: boolean
  /** Premium: auto-clone cadence after end-date. null = one-time event. */
  repeatEvery: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null
  /** Optional single-question poll shown on RSVP form */
  pollQuestion: string | null
  pollOptions: string[] | null
  createdAt: string
}

export interface OwnerEvent extends PublicEvent {
  editToken: string
}

export interface EventPinPreview {
  id: string
  title: string
  coverImageUrl: string | null
  hostName: string | null
}

export type PublicEventResponse = PublicEvent | OwnerEvent | { requiresPin: true; preview: EventPinPreview }

export interface PublicGuest {
  id: string
  status: RsvpStatus
  plusOnes: number
  message: string | null
  guest: PublicUser
  respondedAt: string
}

export interface MyRsvp {
  status: RsvpStatus
  plusOnes: number
  message: string | null
  cancelToken?: string
}
