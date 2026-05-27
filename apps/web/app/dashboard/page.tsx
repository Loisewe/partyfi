import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@wishly/db'
import { DashboardClient } from './DashboardClient'

export const metadata = { title: 'Мои вишлисты' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const wishlists = await prisma.wishlist.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  const formatted = wishlists.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    coverImage: w.coverImage,
    isPublic: w.isPublic,
    shareToken: w.shareToken,
    editToken: w.editToken,
    itemCount: w._count.items,
    updatedAt: w.updatedAt.toISOString(),
  }))

  return (
    <DashboardClient
      wishlists={formatted}
      user={{
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        id: session.user.id,
      }}
    />
  )
}
