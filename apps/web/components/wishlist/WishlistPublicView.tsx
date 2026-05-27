'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Wishlist, WishlistItem, PublicReservation } from '@wishly/shared'
import { formatPrice } from '@wishly/shared'
import { ReserveButton } from './ReserveButton'
import { useWishlistEvents, type WishlistEvent } from '@/lib/hooks/useWishlistEvents'

interface Props {
  wishlist: Wishlist
  shareToken: string
}

export function WishlistPublicView({ wishlist: initial, shareToken }: Props) {
  const [wishlist, setWishlist] = useState(initial)
  // Handle real-time SSE events
  const handleEvent = useCallback((event: WishlistEvent) => {
    setWishlist((prev) => ({
      ...prev,
      items: prev.items?.map((item) => {
        if (item.id !== event.itemId) return item

        if (event.type === 'ITEM_RESERVED') {
          const newReservation: PublicReservation = {
            id: event.reservationId,
            type: 'SOLO',
            visibilityMode: event.reserverName ? 'PUBLIC' : 'HIDDEN_FROM_OWNER',
            status: 'ACTIVE',
            allowJoining: event.allowJoining ?? false,
            message: null,
            reserverName: event.reserverName ?? null,
            kitty: null,
          }
          return { ...item, reservation: newReservation }
        }

        if (event.type === 'ITEM_UNRESERVED') {
          return { ...item, reservation: null }
        }

        return item
      }) ?? [],
    }))
  }, [])

  useWishlistEvents({ shareToken, onEvent: handleEvent })

  const ownerName = wishlist.user.name ?? wishlist.user.nickname ?? 'Аноним'
  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://partyfi.app/w/${shareToken}`

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: wishlist.name,
        text: `Загляни в мой вишлист: ${wishlist.name}`,
        url: shareUrl,
      })
    } else {
      navigator.clipboard.writeText(shareUrl)
      // TODO: show toast
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-500">
            Partyfi
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-100 transition"
          >
            <span>Поделиться</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Wishlist meta */}
        <div className="mb-8">
          {/* Creator */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-white text-sm font-bold">
              {wishlist.user.avatarUrl ? (
                <Image
                  src={wishlist.user.avatarUrl}
                  alt={ownerName}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              ) : (
                ownerName[0]?.toUpperCase()
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{ownerName}</p>
              <p className="text-xs text-gray-400">составил вишлист</p>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900">{wishlist.name}</h1>
          {wishlist.description && (
            <p className="mt-2 text-gray-500">{wishlist.description}</p>
          )}

          {/* Stats */}
          <div className="mt-3 flex gap-4 text-sm text-gray-400">
            <span>{wishlist.itemCount} {itemsWord(wishlist.itemCount)}</span>
          </div>
        </div>

        {/* Items */}
        {wishlist.items && wishlist.items.length > 0 ? (
          <div className="flex flex-col gap-4">
            {wishlist.items.map((item) => (
              <WishlistItemCard key={item.id} item={item} wishlistId={wishlist.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">🎁</div>
            <p>Список пока пуст</p>
          </div>
        )}
      </main>
    </div>
  )
}

function WishlistItemCard({ item }: { item: WishlistItem; wishlistId: string }) {
  const isReserved = item.reservation?.status === 'ACTIVE'

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${
        isReserved ? 'ring-green-200 bg-green-50/50' : 'ring-gray-100 hover:ring-gray-200'
      }`}
    >
      {isReserved && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          {item.reservation?.reserverName
            ? `${item.reservation.reserverName} берёт`
            : 'Уже берут'}
        </div>
      )}

      <div className="flex gap-4 p-4">
        {/* Image */}
        {item.imageUrl ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-3xl">
            🎁
          </div>
        )}

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
          )}
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {item.price != null && item.currency && (
                <span className="text-sm font-bold text-gray-900">
                  {formatPrice(item.price, item.currency)}
                </span>
              )}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-500 hover:underline"
                >
                  Смотреть →
                </a>
              )}
            </div>

            {!isReserved && (
              <ReserveButton itemId={item.id} />
            )}

            {isReserved && item.reservation?.allowJoining && (
              <button className="rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 transition">
                Скинуться
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function itemsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'желание'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'желания'
  return 'желаний'
}
