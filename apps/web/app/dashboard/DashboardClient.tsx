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
    <div className="relative min-h-screen bg-gradient-to-b from-cream-50 via-white to-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] hero-blob pointer-events-none" aria-hidden />

      {/* Header */}
      <header className="relative border-b border-gray-100 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="inline-block w-7 h-7 rounded-lg bg-gradient-celebratory shadow-sm group-hover:scale-105 transition" aria-hidden />
            <span className="font-display text-xl font-extrabold text-ink-900 tracking-tight">Event Gallery</span>
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

      <main className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Welcome */}
        <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
              Твой кабинет
            </p>
            <h1 className="font-display text-display-md text-ink-900">
              Привет,{' '}
              <span className="bg-gradient-celebratory bg-clip-text text-transparent">
                {displayName}
              </span>
              !
            </h1>
            <p className="mt-2 text-ink-900/60">
              {wishlists.length === 0
                ? 'Создай первый вишлист или ивент — поделись ссылкой за минуту'
                : `${wishlists.length} ${wishlistsWord(wishlists.length)} в коллекции`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create-event" className="pill-brand">🎉 Ивент</Link>
            <CreateWishlistButton />
          </div>
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

  if (loading) {
    return (
      <div className="mb-10">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 skeleton rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="mb-10 rounded-3xl border-2 border-dashed border-gray-200 p-8 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <p className="font-display text-lg font-bold text-ink-900 mb-1">Пока ни одного ивента</p>
        <p className="text-sm text-ink-900/60 mb-5 max-w-sm mx-auto">
          Создай первую красивую карточку для дня рождения, новоселья или просто посиделок
        </p>
        <Link href="/create-event" className="pill-brand">
          🎉 Создать ивент
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-ink-900">
          Мои ивенты <span className="text-brand-500">{events.length}</span>
        </h2>
        <Link href="/create-event" className="text-sm font-semibold text-brand-500 hover:underline">
          + новый
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 stagger-parent">
        {events.map((e) => {
          const url = `/e/${e.customSlug ?? e.shareToken}`
          const startsAt = new Date(e.startsAt)
          const isPast = startsAt.getTime() < Date.now()
          const dateStr = startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          const goingTotal = e.rsvpStats.going + e.rsvpStats.plusOnesTotal
          return (
            <Link
              key={e.id}
              href={url}
              className="group relative rounded-3xl bg-white border border-gray-100 shadow-soft hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
            >
              <div className="flex items-stretch">
                <div className="relative w-24 sm:w-32 shrink-0">
                  <DashboardCover slug={(e as any).coverPresetSlug ?? null} url={e.coverImageUrl} />
                </div>
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-display font-bold text-ink-900 line-clamp-1 flex-1 min-w-0">
                      {e.title}
                    </h3>
                    {(e as any).isPremium && (
                      <span className="text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 px-1.5 py-0.5 shrink-0">⭐</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-900/60 mb-2">
                    {dateStr} · {timeStr}
                    {isPast && <span className="ml-1 text-ink-900/40">(прошёл)</span>}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-ink-900/70">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 font-semibold">
                      {goingTotal} 🎉
                    </span>
                    {e.rsvpStats.maybe > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 font-semibold">
                        {e.rsvpStats.maybe} 🤔
                      </span>
                    )}
                    {e.status === 'CANCELLED' && (
                      <span className="rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 font-semibold">отменён</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function DashboardCover({ slug, url }: { slug: string | null; url: string | null }) {
  const gradients: Record<string, string> = {
    birthday: 'from-pink-300 to-yellow-200',
    housewarming: 'from-emerald-200 to-teal-300',
    party: 'from-violet-300 to-fuchsia-300',
    wedding: 'from-rose-200 to-amber-100',
    'baby-shower': 'from-sky-200 to-pink-200',
  }
  const emojis: Record<string, string> = {
    birthday: '🎂', housewarming: '🏠', party: '🎉', wedding: '💍', 'baby-shower': '👶',
  }

  let g = 'from-slate-200 to-slate-100'
  let e = '🎁'
  if (slug) {
    for (const k of Object.keys(gradients)) {
      if (slug.startsWith(k)) {
        g = gradients[k]!
        e = emojis[k] ?? '🎁'
        break
      }
    }
  }
  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${g} flex items-center justify-center`}>
      <span className="text-3xl sm:text-4xl">{e}</span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-200"
          onLoad={(ev) => (ev.currentTarget.style.opacity = '1')}
          onError={(ev) => ev.currentTarget.remove()}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
      <div className="mb-4 text-6xl">🎁</div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Вишлистов пока нет</h2>
      <p className="mt-2 max-w-xs text-sm text-ink-900/60">
        Создай первый — добавляй товары по ссылке за 30 секунд
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
