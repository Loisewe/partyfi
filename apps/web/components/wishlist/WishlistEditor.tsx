'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Wishlist, WishlistItem } from '@wishly/shared'
import { formatPrice } from '@wishly/shared'
import { api } from '@/lib/api-client'
import { AddItemModal } from './AddItemModal'

interface Props {
  wishlist: Wishlist
  editToken: string
}

export function WishlistEditor({ wishlist: initialWishlist, editToken }: Props) {
  const [wishlist, setWishlist] = useState(initialWishlist)
  const [showAddModal, setShowAddModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://partyfi.app'}/w/${wishlist.shareToken}`

  async function handleCopyShare() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDeleteItem(itemId: string) {
    await api.delete(`/wishlists/${wishlist.id}/items/${itemId}`, { editToken })
    setWishlist((prev) => ({
      ...prev,
      items: prev.items?.filter((i) => i.id !== itemId) ?? [],
    }))
  }

  function handleItemAdded(newItem: WishlistItem) {
    setWishlist((prev) => ({
      ...prev,
      items: [...(prev.items ?? []), newItem],
      itemCount: (prev.itemCount ?? 0) + 1,
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-bold text-gray-900">{wishlist.name}</h1>
            <p className="text-xs text-gray-400">Редактирование</p>
          </div>
          <button
            onClick={handleCopyShare}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
            }`}
          >
            {copied ? '✓ Скопировано!' : '🔗 Поделиться'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Add item CTA */}
        <button
          onClick={() => setShowAddModal(true)}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-5 py-4 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 transition"
        >
          <span className="text-2xl">+</span>
          <div>
            <p className="font-semibold">Добавить желание</p>
            <p className="text-xs text-brand-400">По ссылке или вручную</p>
          </div>
        </button>

        {/* Items list */}
        {wishlist.items && wishlist.items.length > 0 ? (
          <div className="flex flex-col gap-3">
            {wishlist.items.map((item) => (
              <EditorItemCard
                key={item.id}
                item={item}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">🎁</div>
            <p className="font-medium">Список пока пуст</p>
            <p className="text-sm mt-1">Добавь первое желание!</p>
          </div>
        )}
      </main>

      {/* Share link footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs text-gray-400 mb-1">Ссылка для гостей:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-xl bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600">
              {shareUrl}
            </div>
            <button
              onClick={handleCopyShare}
              className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition"
            >
              {copied ? '✓' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddItemModal
          wishlistId={wishlist.id}
          editToken={editToken}
          onClose={() => setShowAddModal(false)}
          onItemAdded={handleItemAdded}
        />
      )}
    </div>
  )
}

function EditorItemCard({
  item,
  onDelete,
}: {
  item: WishlistItem
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      {/* Image */}
      {item.imageUrl ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="64px" />
        </div>
      ) : item.scrapeStatus === 'PENDING' ? (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">🎁</div>
      )}

      {/* Info */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="font-semibold text-gray-900 line-clamp-1 text-sm">
          {item.scrapeStatus === 'PENDING' ? (
            <span className="text-gray-400">Загружаем информацию...</span>
          ) : (
            item.name
          )}
        </p>
        {item.price != null && item.currency && (
          <p className="text-sm font-bold text-brand-600">
            {formatPrice(item.price, item.currency)}
          </p>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-brand-500 truncate"
          >
            {new URL(item.sourceUrl).hostname}
          </a>
        )}
      </div>

      {/* Delete */}
      <div className="shrink-0">
        {confirming ? (
          <button
            onClick={onDelete}
            className="rounded-xl bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
          >
            Удалить?
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-xl p-2 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
