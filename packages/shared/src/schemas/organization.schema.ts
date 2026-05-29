import { z } from 'zod'

export const orgSlugSchema = z.string()
  .min(3, 'Минимум 3 символа')
  .max(32, 'Максимум 32 символа')
  .regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис')
  .refine((s) => !s.startsWith('-') && !s.endsWith('-'), 'Не может начинаться или заканчиваться дефисом')

export const orgRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])
export type OrgRole = z.infer<typeof orgRoleSchema>

export const orgPlanSchema = z.enum(['FREE', 'PRO', 'STUDIO'])
export type OrgPlan = z.infer<typeof orgPlanSchema>

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'HEX-цвет, напр. #ff2d7b')

export const createOrgSchema = z.object({
  slug: orgSlugSchema,
  name: z.string().min(1).max(80),
  tagline: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
})

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  coverImageUrl: z.string().url().max(2000).nullable().optional(),
  brandColor: hexColorSchema.nullable().optional(),
  accentColor: hexColorSchema.nullable().optional(),
  fontFamily: z.enum(['system', 'serif', 'mono', 'display']).nullable().optional(),
  websiteUrl: z.string().url().max(500).nullable().optional(),
  telegramHandle: z.string().regex(/^[a-zA-Z0-9_]{5,32}$/).nullable().optional(),
  instagramHandle: z.string().regex(/^[a-zA-Z0-9_.]{1,30}$/).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  isPublic: z.boolean().optional(),
  city: z.string().max(60).nullable().optional(),
})

export const inviteMemberSchema = z.object({
  role: orgRoleSchema.exclude(['OWNER']).default('EDITOR'),
  // Direct add (if userId known) OR generate invite link
  userId: z.string().cuid().optional(),
})

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema.exclude(['OWNER']),
})

export type CreateOrgInput = z.infer<typeof createOrgSchema>
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
