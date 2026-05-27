'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, eventsApi } from '@/lib/api-client'
import { useSession } from 'next-auth/react'
import { CreateWishlistButton } from '@/components/wishlist/CreateWishlistButton'
import type { PublicEvent } from '@wishly/shared'

interface WishlistMeta {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  isPublic: boolean
  shareToken: string
  editToken: string
  itemCount: number
  updatedAt: string
}

interface Props {
  wishlists: WishlistMeta[]
  user: { name: string | null; image: string | null; id: string }
}

export function DashboardClient({ wishlists: initial, user }: Props) {
  const { data: session } = useSession()
  const [wishlists, setWishlists] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, editToken: string) {
    setDeleting(id)
    try {
      await api.delete(`/wishlists/${id}`, {
        editToken,
        // attach JWT if authed
      })
      setWishlists((prev) => prev.filter((w) => w.id !== id))
    } catch {
      alert('Не удалось удалить вишлист')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCopyLink(shareToken: string) {
    const url = `${window.location.origin}/w/${shareToken}`
    await navigator.clipboard.writeText(url)
  }

  const displayName = user.name?.split(' ')[0] ?? 'Аноним'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-brand-500">
            Partyfi
          </Link>
          <div className="flex items-center gap-3">
            {user.image && (
              <Image
                src={user.image}
                alt={displayName}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="hidden text-sm font-medium text-gray-700 sm:block">
              {displayName}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Welcome */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              Привет, {displayName}! 👋
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {wishlists.length === 0
                ? 'Создай первый вишлист и поделись с друзьями'
                : `У тебя ${wishlists.length} ${wishlistsWord(wishlists.length)}`}
            </p>
          </div>
          <CreateWishlistButton />
        </div>

        {/* My events */}
        <MyEventsSection />

        {/* Wishlists grid */}
        {wishlists.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {wishlists.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <WishlistCard
                    wishlist={w}
                    onDelete={handleDelete}
                    onCopyLink={handleCopyLink}
                    isDeleting={deleting === w.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}

function WishlistCard({
  wishlist,
  onDelete,
  onCopyLink,
  isDeleting,
}: {
  wishlist: WishlistMeta
  onDelete: (id: string, editToken: string) => void
  onCopyLink: (shareToken: string) => void
  isDeleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const relativeTime = formatRelativeTime(wishlist.updatedAt)

  async function handleCopy() {
    await onCopyLink(wishlist.shareToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative flex flex-col rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm hover:shadow-md hover:ring-gray-200 transition-all duration-200 overflow-hidden">
      {/* Cover / gradient header */}
      <div className="relative h-24 bg-gradient-to-br from-brand-400 via-violet-400 to-brand-600">
        {wishlist.coverImage && (
          <Image
            src={wishlist.coverImage}
            alt={wishlist.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        )}
        {/* Privacy badge */}
        <div className="absolute left-3 top-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              wishlist.isPublic
                ? 'bg-white/20 text-white backdrop-blur-sm'
                : 'bg-gray-900/40 text-white backdrop-blur-sm'
            }`}
          >
            {wishlist.isPublic ? '🔗 Публичный' : '🔒 Скрытый'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-gray-900 line-clamp-1">{wishlist.name}</h3>
        {wishlist.description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{wishlist.description}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span>🎁 {wishlist.itemCount} {itemsWord(wishlist.itemCount)}</span>
          <span>·</span>
          <span>{relativeTime}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/edit/${wishlist.editToken}`}
            className="flex-1 rounded-xl bg-brand-500 py-2 text-center text-xs font-semibold text-white hover:bg-brand-600 transition"
          >
            Редактировать
          </Link>
          <button
            onClick={handleCopy}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              copied
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title="Скопировать ссылку"
          >
            {copied ? '✓' : '🔗'}
          </button>
          {confirmDelete ? (
            <button
              onClick={() => {
                setConfirmDelete(false)
                onDelete(wishlist.id, wishlist.editToken)
              }}
              disabled={isDeleting}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
            >
              {isDeleting ? '...' : 'Точно?'}
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-400 hover:border-red-200 hover:text-red-400 transition"
              title="Удалить"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MyEventsSection() {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    eventsApi.mine()
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (events.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500 mb-3">У тебя пока нет ивентов</p>
        <Link
          href="/create-event"
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          🎉 Создать ивент
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Мои ивенты</h2>
        <Link href="/create-event" className="text-sm font-medium text-brand-500 hover:underline">
          + новый
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => {
          const url = `/e/${e.customSlug ?? e.shareToken}`
          const startsAt = new Date(e.startsAt).toLocaleString('ru-RU', {
            dateStyle: 'medium', timeStyle: 'short',
          })
          return (
            <Link
              key={e.id}
              href={url}
              className="block rounded-2xl bg-white p-4 ring-1 ring-gray-100 hover:ring-gray-200 hover:shadow-sm transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{e.title}</h3>
              <p className="text-xs text-gray-500 mb-2">{startsAt}</p>
              <p className="text-xs text-gray-600">
                {e.rsvpStats.going} идут · {e.rsvpStats.maybe} может быть
                {e.status === 'CANCELLED' && <span className="text-red-600 ml-1">· отменён</span>}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
      <div className="mb-4 text-6xl">🎁</div>
      <h2 className="text-xl font-bold text-gray-900">Список пуст</h2>
      <p className="mt-2 max-w-xs text-sm text-gray-400">
        Создай первый вишлист — это займёт 30 секунд
      </p>
      <div className="mt-6">
        <CreateWishlistButton />
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function itemsWord(n: number): string {
  const m = n % 10
  const m100 = n % 100
  if (m === 1 && m100 !== 11) return 'желание'
  if (m >= 2 && m <= 4 && (m100 < 10 || m100 >= 20)) return 'желания'
  return 'желаний'
}

function wishlistsWord(n: number): string {
  const m = n % 10
  const m100 = n % 100
  if (m === 1 && m100 !== 11) return 'вишлист'
  if (m >= 2 && m <= 4 && (m100 < 10 || m100 >= 20)) return 'вишлиста'
  return 'вишлистов'
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} дн. назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
