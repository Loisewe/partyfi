'use client'

import { useEffect, useState } from 'react'
import { wishlistsApi, type OwnedWishlistSummary } from '@/lib/api-client'

export function WishlistAttacher({
  selectedId,
  onChange,
}: {
  selectedId: string | null
  onChange: (id: string | null) => void
}) {
  const [wishlists, setWishlists] = useState<OwnedWishlistSummary[] | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'anon' | 'ready'>('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('wishly_access_token')
    if (!token) {
      setAuthState('anon')
      return
    }
    wishlistsApi.mine()
      .then((list) => {
        setWishlists(list)
        setAuthState('ready')
      })
      .catch(() => {
        setAuthState('anon')
      })
  }, [])

  if (authState === 'loading') {
    return <div className="text-sm text-gray-500">Загружаем вишлисты…</div>
  }

  if (authState === 'anon') {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-gray-600">
        <span className="block">✨ Войди через Google, чтобы прикрепить свой вишлист к ивенту.</span>
        <span className="block text-xs text-gray-500 mt-1">
          Гости смогут забронировать подарок прямо со страницы ивента.
        </span>
      </div>
    )
  }

  if (!wishlists || wishlists.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-gray-600">
        <span className="block">У тебя пока нет вишлистов.</span>
        <a href="/" className="text-xs text-blue-600 underline mt-1 inline-block">
          → Создать вишлист
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="radio"
          name="wishlist"
          checked={selectedId === null}
          onChange={() => onChange(null)}
          className="mt-1"
        />
        <span className="text-sm">Не прикреплять вишлист</span>
      </label>
      {wishlists.map((w) => (
        <label key={w.id} className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="wishlist"
            checked={selectedId === w.id}
            onChange={() => onChange(w.id)}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium">{w.name}</span>
            <span className="text-gray-500 ml-1">· {w.itemCount} {pluralizeItem(w.itemCount)}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function pluralizeItem(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'товар'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара'
  return 'товаров'
}
