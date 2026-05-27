import { z } from 'zod'

export const createWishlistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
})

export const updateWishlistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
})

export const createItemSchema = z
  .object({
    sourceUrl: z.string().url('Invalid URL').optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    imageUrl: z.string().url().optional(),
    price: z.number().int().positive().optional(), // minor units
    currency: z.string().length(3).toUpperCase().optional(),
  })
  .refine((data) => data.sourceUrl || data.name, {
    message: 'Either sourceUrl or name is required',
  })

export const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  price: z.number().int().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  position: z.number().int().min(0).optional(),
})

export const reorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().cuid(),
      position: z.number().int().min(0),
    }),
  ),
})

export const createReservationSchema = z.object({
  type: z.enum(['SOLO', 'GROUP']),
  visibilityMode: z.enum(['PUBLIC', 'HIDDEN_FROM_OWNER']),
  allowJoining: z.boolean().optional().default(false),
  message: z.string().max(500).optional(),
  reserverDisplayName: z.string().min(1).max(100).optional(),
})

export const joinGroupGiftSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  pledgedAmount: z.number().int().positive().optional(),
})

export const scrapeUrlSchema = z.object({
  url: z.string().url('Invalid URL'),
})

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>
export type UpdateWishlistInput = z.infer<typeof updateWishlistSchema>
export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>
export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type JoinGroupGiftInput = z.infer<typeof joinGroupGiftSchema>
