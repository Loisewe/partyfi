import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { createItemSchema, updateItemSchema, reorderItemsSchema } from '@wishly/shared'
import { scrapeUrl } from '../../services/scraper.service'
import Redis from 'ioredis'

export const itemRoutes: FastifyPluginAsync = async (app) => {

  // Helper to verify wishlist ownership
  async function verifyOwner(wishlistId: string, request: FastifyRequest) {
    const wishlist = await app.prisma.wishlist.findUnique({ where: { id: wishlistId } })
    if (!wishlist) return null

    const isOwner =
      request.auth.editToken === wishlist.editToken ||
      request.auth.user?.id === wishlist.userId

    return isOwner ? wishlist : null
  }


  // ── POST /wishlists/:wishlistId/items ────────────────────────────────────
  // Add item to wishlist. If sourceUrl provided, trigger scraping.

  app.post('/:wishlistId/items', async (request, reply) => {
    const { wishlistId } = request.params as { wishlistId: string }
    const body = createItemSchema.parse(request.body)

    const wishlist = await verifyOwner(wishlistId, request)
    if (!wishlist) return reply.status(403).send({ error: 'Access denied or wishlist not found' })

    // Get next position
    const maxPosition = await app.prisma.wishlistItem.aggregate({
      where: { wishlistId },
      _max: { position: true },
    })
    const position = (maxPosition._max.position ?? -1) + 1

    if (body.sourceUrl) {
      // Create item immediately with PENDING status, then scrape
      const item = await app.prisma.wishlistItem.create({
        data: {
          wishlistId,
          name: body.sourceUrl, // temporary name until scrape completes
          sourceUrl: body.sourceUrl,
          scrapeStatus: 'PENDING',
          position,
        },
      })

      // Scrape asynchronously (don't await — respond immediately)
      scrapeAndUpdate(item.id, body.sourceUrl, app.redis).catch((err) =>
        app.log.error({ err, itemId: item.id }, 'Scrape failed'),
      )

      reply.status(201)
      return {
        item: formatItem(item),
        scraping: true,
      }
    }

    // Manual item creation
    const item = await app.prisma.wishlistItem.create({
      data: {
        wishlistId,
        name: body.name ?? 'New item',
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        price: body.price ?? null,
        currency: body.currency ?? null,
        sourceUrl: null,
        scrapeStatus: 'NONE',
        position,
      },
    })

    reply.status(201)
    return { item: formatItem(item), scraping: false }
  })


  // ── GET /wishlists/:wishlistId/items/:itemId/scrape-status ──────────────
  // Poll scraping status for an item.

  app.get('/:wishlistId/items/:itemId/scrape-status', async (request, reply) => {
    const { wishlistId, itemId } = request.params as { wishlistId: string; itemId: string }

    const item = await app.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlistId },
    })

    if (!item) return reply.status(404).send({ error: 'Item not found' })

    return {
      status: item.scrapeStatus,
      item: formatItem(item),
    }
  })


  // ── PATCH /wishlists/:wishlistId/items/:itemId ───────────────────────────
  // Update item fields manually (override scraped data).

  app.patch('/:wishlistId/items/:itemId', async (request, reply) => {
    const { wishlistId, itemId } = request.params as { wishlistId: string; itemId: string }
    const body = updateItemSchema.parse(request.body)

    const wishlist = await verifyOwner(wishlistId, request)
    if (!wishlist) return reply.status(403).send({ error: 'Access denied' })

    const item = await app.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlistId },
    })
    if (!item) return reply.status(404).send({ error: 'Item not found' })

    const updated = await app.prisma.wishlistItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.position !== undefined && { position: body.position }),
      },
    })

    return { item: formatItem(updated) }
  })


  // ── DELETE /wishlists/:wishlistId/items/:itemId ──────────────────────────

  app.delete('/:wishlistId/items/:itemId', async (request, reply) => {
    const { wishlistId, itemId } = request.params as { wishlistId: string; itemId: string }

    const wishlist = await verifyOwner(wishlistId, request)
    if (!wishlist) return reply.status(403).send({ error: 'Access denied' })

    await app.prisma.wishlistItem.deleteMany({
      where: { id: itemId, wishlistId },
    })

    reply.status(204)
  })


  // ── POST /wishlists/:wishlistId/items/reorder ────────────────────────────
  // Batch update positions for drag-and-drop reordering.

  app.post('/:wishlistId/items/reorder', async (request, reply) => {
    const { wishlistId } = request.params as { wishlistId: string }
    const body = reorderItemsSchema.parse(request.body)

    const wishlist = await verifyOwner(wishlistId, request)
    if (!wishlist) return reply.status(403).send({ error: 'Access denied' })

    await app.prisma.$transaction(
      body.items.map(({ id, position }) =>
        app.prisma.wishlistItem.update({
          where: { id, wishlistId },
          data: { position },
        }),
      ),
    )

    return { ok: true }
  })
}


// ── Scrape and update item ────────────────────────────────────────────────

async function scrapeAndUpdate(itemId: string, url: string, redis: Redis): Promise<void> {
  const { prisma } = await import('@wishly/db')

  try {
    const { scrapeUrl: scrape } = await import('../../services/scraper.service')

    // Create a redis-compatible wrapper
    const redisWrapper = {
      get: (key: string) => redis.get(key),
      set: (key: string, ttl: number, value: string) => redis.setex(key, ttl, value),
    }

    const scraped = await scrape(url, redisWrapper)

    await prisma.wishlistItem.update({
      where: { id: itemId },
      data: {
        name: scraped.title ?? url,
        description: scraped.description ?? null,
        imageUrl: scraped.imageUrl ?? null,
        price: scraped.price ?? null,
        currency: scraped.currency ?? null,
        scrapeStatus: 'DONE',
        scrapedAt: new Date(),
        scrapeMeta: {
          title: scraped.title,
          description: scraped.description,
          image: scraped.imageUrl,
          siteName: scraped.siteName,
        },
      },
    })
  } catch (err) {
    await prisma.wishlistItem.update({
      where: { id: itemId },
      data: {
        name: url,
        scrapeStatus: 'FAILED',
      },
    })
    throw err
  }
}


// ── Item formatter ────────────────────────────────────────────────────────

function formatItem(item: {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number | null
  currency: string | null
  sourceUrl: string | null
  position: number
  scrapeStatus: string
  createdAt: Date
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    price: item.price,
    currency: item.currency,
    sourceUrl: item.sourceUrl,
    position: item.position,
    scrapeStatus: item.scrapeStatus,
    createdAt: item.createdAt.toISOString(),
  }
}
