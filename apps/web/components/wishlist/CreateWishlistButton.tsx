'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

interface Props {
  size?: 'default' | 'lg'
}

export function CreateWishlistButton({ size = 'default' }: Props) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const router = useRouter()

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)

    try {
      const result = await api.post<{ wishlist: { id: string }; editToken?: string }>(
        '/wishlists',
        { name: name.trim() },
      )

      // Persist editToken for anonymous users
      if (result.editToken) {
        const stored = JSON.parse(
          localStorage.getItem('wishly_edit_tokens') ?? '{}',
        ) as Record<string, string>
        stored[result.wishlist.id] = result.editToken
        localStorage.setItem('wishly_edit_tokens', JSON.stringify(stored))

        router.push(`/edit/${result.editToken}`)
      } else {
        router.push(`/edit/${(result.wishlist as { editToken?: string }).editToken}`)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const sizeClasses =
    size === 'lg'
      ? 'px-8 py-4 text-base'
      : 'px-6 py-3 text-sm'

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-600 active:scale-95 ${sizeClasses}`}
      >
        🎁 Создать вишлист
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setShowModal(false)}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-bold text-gray-900">Новый вишлист</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="День рождения, Новый год, Свадьба..."
          autoFocus
          maxLength={100}
          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none ring-brand-300 transition focus:ring-2 focus:border-brand-400"
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 rounded-2xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 transition"
          >
            {loading ? 'Создаём...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
