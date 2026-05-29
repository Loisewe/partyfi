import type { PrismaClient } from '@prisma/client'

export type OrgAccess = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | null

/** Hierarchy: OWNER > ADMIN > EDITOR > VIEWER */
const RANK: Record<NonNullable<OrgAccess>, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
}

/**
 * Resolve the caller's effective role inside an organization.
 * Owner is special-cased (ownerUserId match returns OWNER regardless of member row).
 * Returns null if not a member at all.
 */
export async function getOrgRole(
  prisma: PrismaClient,
  organizationId: string,
  userId: string | undefined,
): Promise<OrgAccess> {
  if (!userId) return null

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  })
  if (!org) return null
  if (org.ownerUserId === userId) return 'OWNER'

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, acceptedAt: true },
  })
  if (!member || !member.acceptedAt) return null
  return member.role
}

/** True if `role` is at least `min` in the hierarchy. */
export function hasOrgRole(role: OrgAccess, min: NonNullable<OrgAccess>): boolean {
  if (!role) return false
  return RANK[role] >= RANK[min]
}
