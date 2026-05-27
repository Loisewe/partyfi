import { z } from 'zod'

export const recurrenceCadenceSchema = z.enum(['WEEKLY', 'MONTHLY', 'YEARLY'])
export type RecurrenceCadence = z.infer<typeof recurrenceCadenceSchema>

export const pollOptionsSchema = z
  .array(z.string().min(1).max(80))
  .min(2, 'Минимум 2 варианта')
  .max(6, 'Максимум 6 вариантов')

export const agendaItemSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Формат HH:MM').optional().nullable(),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
})

export const agendaSchema = z.array(agendaItemSchema).max(30)
export type AgendaItem = z.infer<typeof agendaItemSchema>

export const themeColorSchema = z.enum([
  'rose',
  'violet',
  'emerald',
  'amber',
  'sky',
  'slate',
])
export type ThemeColor = z.infer<typeof themeColorSchema>

export const externalLinkSchema = z.object({
  emoji: z.string().max(8).optional().nullable(),
  title: z.string().min(1).max(60),
  url: z.string().url().max(2000),
})
export type ExternalLink = z.infer<typeof externalLinkSchema>

// Server enforces premium cap (10 vs 3); base schema allows up to 10
export const externalLinksSchema = z.array(externalLinkSchema).max(10)

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
  // Premium feature — recurring auto-duplicate
  repeatEvery: recurrenceCadenceSchema.nullable().optional(),
  // Optional single-question poll
  pollQuestion: z.string().min(1).max(200).optional(),
  pollOptions: pollOptionsSchema.optional(),
  // Optional agenda
  agenda: agendaSchema.optional(),
  // Premium-only theme color (enforced server-side)
  themeColor: themeColorSchema.nullable().optional(),
  // band.link-style external links — free 3, premium 10
  externalLinks: externalLinksSchema.optional(),
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
  pollAnswer: z.string().max(80).optional(),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type CancelEventInput = z.infer<typeof cancelEventSchema>
export type VerifyPinInput   = z.infer<typeof verifyPinSchema>
export type CreateRsvpInput  = z.infer<typeof createRsvpSchema>
