import type { PublicUser } from './user'

export interface Wishlist {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  isPublic: boolean
  shareToken: string
  itemCount: number
  user: PublicUser
  items?: WishlistItem[]
  createdAt: string
  updatedAt: string
}

// Returned to the owner only (includes editToken)
export interface WishlistOwnerView extends Wishlist {
  editToken: string
}

export interface WishlistItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number | null // minor units (e.g. 4999 = $49.99)
  currency: string | null
  sourceUrl: string | null
  position: number
  scrapeStatus: 'NONE' | 'PENDING' | 'DONE' | 'FAILED'
  reservation: PublicReservation | null
  createdAt: string
}

// What viewers see about a reservation (never leaks userId)
export interface PublicReservation {
  id: string
  type: 'SOLO' | 'GROUP'
  visibilityMode: 'PUBLIC' | 'HIDDEN_FROM_OWNER'
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED'
  allowJoining: boolean
  message: string | null
  // Only present when viewer is NOT the wishlist owner AND visibilityMode=PUBLIC
  // OR viewer is not the owner and visibilityMode=HIDDEN_FROM_OWNER
  reserverName: string | null
  kitty: PublicKitty | null
}

export interface PublicKitty {
  targetAmount: number
  collectedAmount: number
  currency: string
  status: 'OPEN' | 'GOAL_REACHED' | 'CLOSED' | 'REFUNDED'
  participantCount: number
}

