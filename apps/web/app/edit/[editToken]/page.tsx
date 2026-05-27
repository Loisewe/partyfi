'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { WishlistEditor } from '@/components/wishlist/WishlistEditor'
import type { Wishlist } from '@wishly/shared'
import { api } from '@/lib/api-client'

export default function EditPage() {
  const { editToken } = useParams() as { editToken: string }
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Wishlist>(`/wishlists/${editToken}/edit`, { editToken })
      .then((data) => {
        setWishlist(data)
        // Persist editToken for future visits
        if (typeof window !== 'undefined') {
          const stored = JSON.parse(localStorage.getItem('wishly_edit_tokens') ?? '{}') as Record<string, string>
          stored[data.id] = editToken
          localStorage.setItem('wishly_edit_tokens', JSON.stringify(stored))
        }
      })
      .catch(() => setError('Вишлист не найден или ссылка устарела'))
      .finally(() => setLoading(false))
  }, [editToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    )
  }

  if (error || !wishlist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900">Вишлист не найден</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  return <WishlistEditor wishlist={wishlist} editToken={editToken} />
}
