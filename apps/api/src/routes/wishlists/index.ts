import type { FastifyPluginAsync } from 'fastify'
import { generateNickname } from '@wishly/shared'
import { createWishlistSchema, updateWishlistSchema } from '@wishly/shared'
import type { User, Wishlist, WishlistItem } from '@wishly/db'
import type { PublicUser, PublicReservation } from '@wishly/shared'
import { requireAuth } from '../../plugins/auth'

export const wishlistRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /wishlists ─────────────────────────────────────────────────────
  // Create a new wishlist. Works for both anonymous and authenticated users.
  // Anonymous: creates a new User with a nickname. Returns editToken.
  // Authenticated: uses existing user.

  app.post('/', async (request, reply) => {
    const body = createWishlistSchema.parse(request.body)

    let userId: string

    if (request.auth.user) {
      userId = request.auth.user.id
    } else {
      // Anonymous: create a new user with a generated nickname
      const newUser = await app.prisma.user.create({
        data: {
          isAnonymous: true,
          nickname: generateNickname(),
        },
      })
      userId = newUser.id
    }

    const wishlist = await app.prisma.wishlist.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        userId,
      },
      include: {
        user: true,
        items: true,
      },
    })

    reply.status(201)
    return {
      wishlist: formatWishlistOwnerView(wishlist),
      // Return editToken only if user is anonymous (auth users use JWT)
      editToken: request.auth.user ? undefined : wishlist.editToken,
    }
  })


  // ── GET /wishlists ──────────────────────────────────────────────────────
  // List authenticated user's wishlists.

  app.get('/', async (request) => {
    const user = requireAuth(request)

    const wishlists = await app.prisma.wishlist.findMany({
      where: { userId: user.id },
      include: {
        user: true,
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return wishlists.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      coverImage: w.coverImage,
      isPublic: w.isPublic,
      shareToken: w.shareToken,
      editToken: w.editToken,
      itemCount: w._count.items,
      updatedAt: w.updatedAt.toISOString(),
      createdAt: w.createdAt.toISOString(),
    }))
  })


  // ── GET /wishlists/:shareToken ──────────────────────────────────────────
  // Public view. Reservation privacy logic applied here.

  app.get('/:shareToken', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string }

    const wishlist = await app.prisma.wishlist.findUnique({
      where: { shareToken },
      include: {
        user: true,
        items: {
          where: { scrapeStatus: { not: 'PENDING' } },
          orderBy: { position: 'asc' },
          include: {
            reservation: {
              include: {
                user: true,
                kitty: {
                  include: {
                    _count: { select: { payments: { where: { status: 'SUCCEEDED' } } } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!wishlist) return reply.status(404).send({ error: 'Wishlist not found' })
    if (!wishlist.isPublic) {
      // Private wishlist: only accessible with editToken
      if (request.auth.editToken !== wishlist.editToken && request.auth.user?.id !== wishlist.userId) {
        return reply.status(403).send({ error: 'This wishlist is private' })
      }
    }

    // Determine if the requester is the owner
    const isOwner =
      request.auth.editToken === wishlist.editToken ||
      request.auth.user?.id === wishlist.userId

    return formatWishlistPublicView(wishlist, isOwner)
  })


  // ── GET /wishlists/:editToken/edit ──────────────────────────────────────
  // Owner edit view. Requires editToken (anon) or JWT (auth owner).

  app.get('/:editToken/edit', async (request, reply) => {
    const { editToken } = request.params as { editToken: string }

    const wishlist = await app.prisma.wishlist.findUnique({
      where: { editToken },
      include: {
        user: true,
        items: {
          orderBy: { position: 'asc' },
          include: {
            reservation: {
              include: {
                user: true,
                kitty: {
                  include: {
                    _count: { select: { payments: { where: { status: 'SUCCEEDED' } } } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!wishlist) return reply.status(404).send({ error: 'Wishlist not found' })

    // Verify access
    const isAuthOwner = request.auth.user?.id === wishlist.userId
    const isAnonOwner = request.auth.editToken === editToken

    if (!isAuthOwner && !isAnonOwner) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    return formatWishlistOwnerView(wishlist)
  })


  // ── PATCH /wishlists/:id ────────────────────────────────────────────────
  // Update wishlist metadata.

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateWishlistSchema.parse(request.body)

    const wishlist = await app.prisma.wishlist.findUnique({ where: { id } })
    if (!wishlist) return reply.status(404).send({ error: 'Wishlist not found' })

    const isOwner =
      request.auth.editToken === wishlist.editToken ||
      request.auth.user?.id === wishlist.userId
    if (!isOwner) return reply.status(403).send({ error: 'Access denied' })

    const updated = await app.prisma.wishlist.update({
      where: { id },
      data: body,
      include: { user: true },
    })

    return formatWishlistOwnerView({ ...updated, items: [] })
  })


  // ── DELETE /wishlists/:id ───────────────────────────────────────────────
  // Delete wishlist and all its items.

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const wishlist = await app.prisma.wishlist.findUnique({ where: { id } })
    if (!wishlist) return reply.status(404).send({ error: 'Wishlist not found' })

    const isOwner =
      request.auth.editToken === wishlist.editToken ||
      request.auth.user?.id === wishlist.userId
    if (!isOwner) return reply.status(403).send({ error: 'Access denied' })

    await app.prisma.wishlist.delete({ where: { id } })
    reply.status(204)
  })
}


// ── Formatting helpers ─────────────────────────────────────────────────────

type WishlistWithRelations = Wishlist & {
  user: User
  items: Array<WishlistItem & {
    reservation?: {
      id: string
      type: string
      visibilityMode: string
      status: string
      allowJoining: boolean
      message: string | null
      reserverDisplayName: string | null
      user: User
      kitty: ({ _count: { payments: number } } & {
        targetAmount: number
        collectedAmount: number
        currency: string
        status: string
      }) | null
    } | null
  }>
}

function formatUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    isAnonymous: user.isAnonymous,
  }
}

function formatItem(item: WishlistWithRelations['items'][number], isOwner: boolean) {
  const reservation = item.reservation
  let publicReservation: PublicReservation | null = null

  if (reservation && reservation.status === 'ACTIVE') {
    const isPublicMode = reservation.visibilityMode === 'PUBLIC'
    // If HIDDEN_FROM_OWNER mode, owner should NOT see the reserver name
    // If PUBLIC mode, everyone sees the name
    const reserverName =
      isOwner && !isPublicMode
        ? null
        : (reservation.reserverDisplayName ?? reservation.user.name ?? reservation.user.nickname)

    publicReservation = {
      id: reservation.id,
      type: reservation.type as 'SOLO' | 'GROUP',
      visibilityMode: reservation.visibilityMode as 'PUBLIC' | 'HIDDEN_FROM_OWNER',
      status: reservation.status as 'ACTIVE' | 'CANCELLED' | 'COMPLETED',
      allowJoining: reservation.allowJoining,
      message: reservation.message,
      reserverName,
      kitty: reservation.kitty
        ? {
            targetAmount: reservation.kitty.targetAmount,
            collectedAmount: reservation.kitty.collectedAmount,
            currency: reservation.kitty.currency,
            status: reservation.kitty.status as 'OPEN' | 'GOAL_REACHED' | 'CLOSED' | 'REFUNDED',
            participantCount: reservation.kitty._count.payments,
          }
        : null,
    }
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    price: item.price,
    currency: item.currency,
    sourceUrl: item.sourceUrl,
    position: item.position,
    scrapeStatus: item.scrapeStatus as 'NONE' | 'PENDING' | 'DONE' | 'FAILED',
    reservation: publicReservation,
    createdAt: item.createdAt.toISOString(),
  }
}

function formatWishlistPublicView(
  wishlist: WishlistWithRelations,
  isOwner: boolean,
) {
  return {
    id: wishlist.id,
    name: wishlist.name,
    description: wishlist.description,
    coverImage: wishlist.coverImage,
    isPublic: wishlist.isPublic,
    shareToken: wishlist.shareToken,
    itemCount: wishlist.items.length,
    user: formatUser(wishlist.user),
    items: wishlist.items.map((item) => formatItem(item, isOwner)),
    isOwner,
    createdAt: wishlist.createdAt.toISOString(),
    updatedAt: wishlist.updatedAt.toISOString(),
  }
}

function formatWishlistOwnerView(
  wishlist: Omit<WishlistWithRelations, 'items'> & { items: WishlistWithRelations['items'] },
) {
  return {
    id: wishlist.id,
    name: wishlist.name,
    description: wishlist.description,
    coverImage: wishlist.coverImage,
    isPublic: wishlist.isPublic,
    shareToken: wishlist.shareToken,
    editToken: wishlist.editToken,
    itemCount: wishlist.items.length,
    user: formatUser(wishlist.user),
    items: wishlist.items.map((item) => formatItem(item, true)),
    isOwner: true,
    createdAt: wishlist.createdAt.toISOString(),
    updatedAt: wishlist.updatedAt.toISOString(),
  }
}
