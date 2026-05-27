import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WishlistPublicView } from '@/components/wishlist/WishlistPublicView'
import type { Wishlist } from '@wishly/shared'

interface Props {
  params: { shareToken: string }
}

async function fetchWishlist(shareToken: string): Promise<Wishlist | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wishlists/${shareToken}`, {
      next: { revalidate: 30 }, // ISR: revalidate every 30 seconds
    })
    if (!res.ok) return null
    return res.json() as Promise<Wishlist>
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const wishlist = await fetchWishlist(params.shareToken)
  if (!wishlist) return { title: 'Вишлист не найден' }

  const ownerName = wishlist.user.name ?? wishlist.user.nickname ?? 'Аноним'
  const title = `${wishlist.name} — список желаний ${ownerName}`
  const description =
    wishlist.description ??
    `${wishlist.itemCount} ${itemsWord(wishlist.itemCount)} в вишлисте`

  const image =
    wishlist.coverImage ??
    (wishlist.items && wishlist.items.length > 0 ? wishlist.items[0]?.imageUrl : null) ??
    '/og-default.png'

  return {
    title,
    description,
    openGraph: {
      title: wishlist.name,
      description,
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function WishlistPage({ params }: Props) {
  const wishlist = await fetchWishlist(params.shareToken)
  if (!wishlist) notFound()

  return <WishlistPublicView wishlist={wishlist} shareToken={params.shareToken} />
}

// Grammatically correct Russian plurals for item count
function itemsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'желание'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'желания'
  return 'желаний'
}
