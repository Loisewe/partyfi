import { z } from 'zod'

export const createEventSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(120),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().max(64).default('Europe/Moscow'),
  location: z.string().max(500).optional(),
  locationLink: z.string().url().max(2000).optional(),
  coverPresetId: z.string().cuid().optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN должен быть из 4 цифр').optional(),
  wishlistId: z.string().cuid().optional(),
  rsvpVisibility: z.enum(['ALL_GUESTS', 'HOST_ONLY']).default('ALL_GUESTS'),
  remindersEnabled: z.boolean().default(true),
})

export const updateEventSchema = createEventSchema.partial().extend({
  cancelMessage: z.string().max(500).optional(),
  customSlug: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(40, 'Максимум 40 символов')
    .regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис')
    .nullable()
    .optional(),
})

export const cancelEventSchema = z.object({
  cancelMessage: z.string().min(1, 'Укажите причину').max(500),
})

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

export const createRsvpSchema = z.object({
  status: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
  ),
  plusOnes: z.number().int().min(0).max(10).default(0),
  message: z.string().max(500).optional(),
  guestDisplayName: z.string().min(1).max(100).optional(),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type CancelEventInput = z.infer<typeof cancelEventSchema>
export type VerifyPinInput   = z.infer<typeof verifyPinSchema>
export type CreateRsvpInput  = z.infer<typeof createRsvpSchema>
