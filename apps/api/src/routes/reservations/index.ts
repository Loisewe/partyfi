import type { FastifyPluginAsync } from 'fastify'
import crypto from 'crypto'
import { createReservationSchema, joinGroupGiftSchema, generateNickname } from '@wishly/shared'
import { publishWishlistEvent } from '../sse'

export const reservationRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /items/:itemId/reserve ─────────────────────────────────────────
  // Reserve a wishlist item. Works for both anonymous and authenticated users.

  app.post('/items/:itemId/reserve', async (request, reply) => {
    const { itemId } = request.params as { itemId: string }
    const body = createReservationSchema.parse(request.body)

    const item = await app.prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { reservation: true },
    })

    if (!item) return reply.status(404).send({ error: 'Item not found' })
    if (item.reservation?.status === 'ACTIVE') {
      return reply.status(409).send({ error: 'Item already reserved' })
    }

    // Get or create user for anonymous reserver
    let userId: string
    if (request.auth.user) {
      userId = request.auth.user.id
    } else {
      if (!body.reserverDisplayName) {
        return reply.status(400).send({ error: 'reserverDisplayName required for anonymous reservation' })
      }
      // Create ephemeral anonymous user for the reserver
      const anonUser = await app.prisma.user.create({
        data: {
          isAnonymous: true,
          nickname: generateNickname(),
        },
      })
      userId = anonUser.id
    }

    // Generate cancelToken for anonymous cancellation
    const cancelToken = crypto.randomBytes(32).toString('base64url')
    const cancelTokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex')

    const reservation = await app.prisma.reservation.create({
      data: {
        itemId,
        userId,
        type: body.type,
        visibilityMode: body.visibilityMode,
        allowJoining: body.allowJoining ?? false,
        message: body.message ?? null,
        reserverDisplayName: body.reserverDisplayName ?? null,
        cancelTokenHash,
        status: 'ACTIVE',
      },
    })

    // Fetch the wishlist ID for SSE publishing
    const itemWithWishlist = await app.prisma.wishlistItem.findUnique({
      where: { id: itemId },
      select: { wishlistId: true },
    })

    // Publish real-time event to all viewers of this wishlist
    if (itemWithWishlist) {
      publishWishlistEvent(app.redis, itemWithWishlist.wishlistId, {
        type: 'ITEM_RESERVED',
        itemId,
        reservationId: reservation.id,
        isReserved: true,
        allowJoining: reservation.allowJoining,
        // Only expose reserver name if PUBLIC mode
        reserverName:
          reservation.visibilityMode === 'PUBLIC'
            ? (body.reserverDisplayName ?? null)
            : null,
      }).catch(() => { /* non-critical */ })
    }

    reply.status(201)
    return {
      reservation: {
        id: reservation.id,
        type: reservation.type,
        visibilityMode: reservation.visibilityMode,
        allowJoining: reservation.allowJoining,
        message: reservation.message,
        status: reservation.status,
      },
      // Return cancelToken once to the reserver (never stored in plaintext again)
      cancelToken,
    }
  })


  // ── DELETE /reservations/:id ────────────────────────────────────────────
  // Cancel a reservation. Auth user must be the reserver, or provide cancelToken.

  app.delete('/reservations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { cancelToken } = request.query as { cancelToken?: string }

    const reservation = await app.prisma.reservation.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!reservation) return reply.status(404).send({ error: 'Reservation not found' })
    if (reservation.status !== 'ACTIVE') {
      return reply.status(409).send({ error: 'Reservation is not active' })
    }

    // Verify ownership
    let canCancel = false

    if (request.auth.user?.id === reservation.userId) {
      canCancel = true
    } else if (cancelToken && reservation.cancelTokenHash) {
      const hash = crypto.createHash('sha256').update(cancelToken).digest('hex')
      canCancel = hash === reservation.cancelTokenHash
    }

    if (!canCancel) return reply.status(403).send({ error: 'Cannot cancel this reservation' })

    const updated = await app.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { item: { select: { wishlistId: true } } },
    })

    // Notify all viewers that the item is now available again
    publishWishlistEvent(app.redis, updated.item.wishlistId, {
      type: 'ITEM_UNRESERVED',
      itemId: updated.itemId,
      reservationId: id,
      isReserved: false,
    }).catch(() => { /* non-critical */ })

    reply.status(204)
  })


  // ── POST /reservations/:id/join ─────────────────────────────────────────
  // Join a group gift reservation.

  app.post('/reservations/:id/join', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = joinGroupGiftSchema.parse(request.body)

    const reservation = await app.prisma.reservation.findUnique({
      where: { id },
    })

    if (!reservation) return reply.status(404).send({ error: 'Reservation not found' })
    if (!reservation.allowJoining) return reply.status(403).send({ error: 'This gift is not open for joining' })
    if (reservation.status !== 'ACTIVE') return reply.status(409).send({ error: 'Reservation is not active' })

    const cancelToken = crypto.randomBytes(32).toString('base64url')
    const cancelTokenHash = crypto.createHash('sha256').update(cancelToken).digest('hex')

    const participant = await app.prisma.groupGiftParticipant.create({
      data: {
        reservationId: id,
        displayName: body.displayName,
        email: body.email ?? null,
        pledgedAmount: body.pledgedAmount ?? null,
        cancelTokenHash,
      },
    })

    reply.status(201)
    return {
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        pledgedAmount: participant.pledgedAmount,
      },
      cancelToken,
    }
  })


  // ── GET /reservations/:id/participants ──────────────────────────────────
  // List participants of a group gift. Visible to guests (not the owner).

  app.get('/reservations/:id/participants', async (request, reply) => {
    const { id } = request.params as { id: string }

    const reservation = await app.prisma.reservation.findUnique({
      where: { id },
      include: {
        participants: {
          select: {
            id: true,
            displayName: true,
            pledgedAmount: true,
            isPaid: true,
          },
        },
        item: {
          select: {
            wishlistId: true,
            wishlist: { select: { userId: true, editToken: true } },
          },
        },
      },
    })

    if (!reservation) return reply.status(404).send({ error: 'Reservation not found' })

    return {
      reservationId: id,
      participants: reservation.participants,
    }
  })
}
