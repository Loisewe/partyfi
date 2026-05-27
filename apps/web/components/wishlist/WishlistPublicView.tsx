'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Wishlist, WishlistItem, PublicReservation } from '@wishly/shared'
import { formatPrice } from '@wishly/shared'
import { ReserveButton } from './ReserveButton'
import { useWishlistEvents, type WishlistEvent } from '@/lib/hooks/useWishlistEvents'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'

interface Props {
  wishlist: Wishlist
  shareToken: string
}

export function WishlistPublicView({ wishlist: initial, shareToken }: Props) {
  const toast = useToast()
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
      : `https://eventgallery.app/w/${shareToken}`

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: wishlist.name,
          text: `Загляни в мой вишлист: ${wishlist.name}`,
          url: shareUrl,
        })
        return
      } catch {
        // cancelled
        return
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.show('Ссылка скопирована', 'success')
    } catch {
      // noop
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-cream-50 via-white to-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] hero-blob pointer-events-none" aria-hidden />

      {/* Header */}
      <header className="relative bg-white/70 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="inline-block w-7 h-7 rounded-lg bg-gradient-celebratory shadow-sm group-hover:scale-105 transition" aria-hidden />
            <span className="font-display text-lg font-extrabold text-ink-900 tracking-tight">Event Gallery</span>
          </Link>
          <button onClick={handleShare} className="pill-secondary text-xs px-3 py-1.5">
            📤 Поделиться
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Wishlist meta */}
        <div className="mb-10 animate-slide-up">
          <div className="mb-5 flex items-center gap-3">
            <Avatar
              name={ownerName}
              src={wishlist.user.avatarUrl}
              seed={wishlist.user.id}
              size="lg"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">
                Список желаний
              </p>
              <p className="text-sm font-medium text-ink-900">{ownerName}</p>
            </div>
          </div>

          <h1 className="font-display text-display-md text-balance text-ink-900">{wishlist.name}</h1>
          {wishlist.description && (
            <p className="mt-3 text-ink-900/70 text-pretty leading-relaxed">{wishlist.description}</p>
          )}

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 px-3 py-1 font-semibold">
              🎁 {wishlist.itemCount} {itemsWord(wishlist.itemCount)}
            </span>
          </div>
        </div>

        {/* Items */}
        {wishlist.items && wishlist.items.length > 0 ? (
          <div className="flex flex-col gap-3 stagger-parent">
            {wishlist.items.map((item) => (
              <WishlistItemCard key={item.id} item={item} wishlistId={wishlist.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 py-16 text-center">
            <div className="text-5xl mb-3">🎁</div>
            <p className="font-display text-lg font-bold text-ink-900">Список пока пуст</p>
            <p className="text-sm text-ink-900/60 mt-1">Загляни попозже — хост ещё добавит</p>
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
      className={`relative overflow-hidden rounded-3xl bg-white border transition-all duration-300 ${
        isReserved
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-gray-100 shadow-soft hover:shadow-lifted hover:-translate-y-0.5'
      }`}
    >
      {isReserved && (
        <div className="absolute right-3 top-3 z-10 rounded-full bg-emerald-500 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">
          {item.reservation?.reserverName
            ? `✓ ${item.reservation.reserverName}`
            : '✓ забронировано'}
        </div>
      )}

      <div className="flex gap-4 p-4 sm:p-5">
        {/* Image */}
        {item.imageUrl ? (
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="112px"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-soft text-3xl">
            🎁
          </div>
        )}

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <h3 className="font-display font-bold text-ink-900 leading-snug line-clamp-2">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-sm text-ink-900/60 line-clamp-2">{item.description}</p>
          )}
          <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              {item.price != null && item.currency && (
                <span className="text-base font-display font-bold text-ink-900 tabular-nums">
                  {formatPrice(item.price, item.currency)}
                </span>
              )}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-500 hover:underline"
                >
                  Открыть →
                </a>
              )}
            </div>

            {!isReserved && <ReserveButton itemId={item.id} />}

            {isReserved && item.reservation?.allowJoining && (
              <button className="rounded-xl bg-violet-500 hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition">
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
