'use client'

import { useCallback, useEffect, useState } from 'react'
import { discoverApi, type DiscoverItem } from '@/lib/api-client'
import { CoverImage } from '@/components/event/CoverImage'
import { themeStyles } from '@/lib/event-theme'

export function DiscoverClient() {
  const [items, setItems] = useState<DiscoverItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [city, setCity] = useState('')

  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const { items: list, nextCursor } = await discoverApi.list({ city: city || undefined })
      setItems(list)
      setCursor(nextCursor)
      setHasMore(!!nextCursor)
    } finally {
      setLoading(false)
    }
  }, [city])

  useEffect(() => { loadFirst() }, [loadFirst])

  async function loadMore() {
    if (!cursor) return
    const { items: list, nextCursor } = await discoverApi.list({ city: city || undefined, cursor })
    setItems((prev) => [...prev, ...list])
    setCursor(nextCursor)
    setHasMore(!!nextCursor)
  }

  return (
    <main className="relative min-h-screen pb-16 bg-gradient-to-b from-cream-50 via-white to-white">
      <div className="container mx-auto max-w-5xl px-4 pt-6 sm:pt-10">
        <header className="mb-8 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
            ✨ Открытые ивенты
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-ink-900 tracking-tight">
            Что происходит
          </h1>
          <p className="text-ink-900/60 text-sm sm:text-base mt-2 max-w-lg">
            Ивенты, которые хосты сделали публичными. Заходи и присоединяйся.
          </p>
        </header>

        <div className="mb-6 flex items-center gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Город (Москва, Питер, ...)"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-brand-300"
          />
          {city && (
            <button
              onClick={() => setCity('')}
              className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm text-ink-900/60"
            >
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0,1,2,3,4,5].map((i) => <div key={i} className="aspect-[3/4] skeleton rounded-3xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-3">🍃</div>
            <p className="text-ink-900/70 font-medium">Пока пусто.</p>
            <p className="text-ink-900/40 text-sm mt-2">
              {city
                ? `В городе «${city}» ничего не нашли. Попробуй без фильтра.`
                : 'Хосты ещё не открыли свои ивенты. Будь первым:'}
            </p>
            {!city && (
              <a
                href="/create-event"
                className="pill bg-ink-900 text-white text-sm mt-4 inline-block"
              >
                Создать ивент →
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => <DiscoverCard key={item.slug} item={item} />)}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  className="pill bg-white border border-gray-200 text-ink-900 text-sm"
                >
                  Показать ещё
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function DiscoverCard({ item }: { item: DiscoverItem }) {
  const theme = themeStyles(item.themeColor)
  const date = new Date(item.startsAt)
  const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  return (
    <a
      href={`/e/${item.slug}`}
      className="group block rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-soft hover:shadow-lifted hover:-translate-y-1 transition"
    >
      <CoverImage
        imageUrl={item.coverImageUrl}
        coverPresetSlug={item.coverPresetSlug}
        themeGradient={theme.coverGradient}
        className="w-full aspect-[4/3] overflow-hidden"
      />
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-ink-900/60 mb-1.5">
          <span className="font-semibold text-brand-500">{dateStr}</span>
          <span>·</span>
          <span>{timeStr}</span>
          {item.city && (
            <>
              <span>·</span>
              <span>📍 {item.city}</span>
            </>
          )}
        </div>
        <h3 className="font-display font-bold text-ink-900 text-lg leading-tight mb-1 line-clamp-2 group-hover:text-brand-600 transition">
          {item.title}
        </h3>
        <p className="text-xs text-ink-900/50">
          {item.hostName} · {item.goingCount} идут
        </p>
      </div>
    </a>
  )
}
