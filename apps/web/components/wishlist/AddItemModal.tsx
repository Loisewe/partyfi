'use client'

import { useState } from 'react'
import type { WishlistItem, ScrapedData } from '@wishly/shared'
import { api } from '@/lib/api-client'

interface Props {
  wishlistId: string
  editToken: string
  onClose: () => void
  onItemAdded: (item: WishlistItem) => void
}

type Mode = 'choose' | 'url' | 'manual'

export function AddItemModal({ wishlistId, editToken, onClose, onItemAdded }: Props) {
  const [mode, setMode] = useState<Mode>('choose')
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scraped, setScraped] = useState<ScrapedData | null>(null)
  const [loading, setLoading] = useState(false)

  // Manual form state
  const [manual, setManual] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'RUB',
    sourceUrl: '',
  })

  async function handleScrapePreview() {
    if (!url.trim()) return
    setScraping(true)
    try {
      const result = await api.post<ScrapedData>('/scrape', { url: url.trim() })
      setScraped(result)
      // Pre-fill manual fields with scraped data
      setManual((prev) => ({
        ...prev,
        name: result.title ?? '',
        description: result.description ?? '',
        price: result.price ? String(result.price / 100) : '',
        sourceUrl: url.trim(),
      }))
    } catch {
      // Scrape failed — show manual form anyway
      setManual((prev) => ({ ...prev, sourceUrl: url.trim() }))
    } finally {
      setScraping(false)
      setMode('manual')
    }
  }

  async function handleAddByUrl() {
    setLoading(true)
    try {
      const result = await api.post<{ item: WishlistItem }>(
        `/wishlists/${wishlistId}/items`,
        { sourceUrl: url.trim() },
        { editToken },
      )
      onItemAdded(result.item)
      onClose()
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }

  async function handleAddManual() {
    if (!manual.name.trim()) return
    setLoading(true)
    try {
      const priceInMinor = manual.price ? Math.round(parseFloat(manual.price) * 100) : undefined
      const result = await api.post<{ item: WishlistItem }>(
        `/wishlists/${wishlistId}/items`,
        {
          name: manual.name.trim(),
          description: manual.description.trim() || undefined,
          price: priceInMinor,
          currency: manual.currency || undefined,
          sourceUrl: manual.sourceUrl.trim() || undefined,
          imageUrl: scraped?.imageUrl ?? undefined,
        },
        { editToken },
      )
      onItemAdded(result.item)
      onClose()
    } catch {
      // handle
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Choose mode */}
        {mode === 'choose' && (
          <>
            <h2 className="mb-5 text-xl font-bold text-gray-900">Добавить желание</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode('url')}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <span className="text-2xl">🔗</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">По ссылке</p>
                  <p className="text-xs text-gray-400">Вставь URL — мы всё загрузим сами</p>
                </div>
              </button>
              <button
                onClick={() => setMode('manual')}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <span className="text-2xl">✏️</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">Вручную</p>
                  <p className="text-xs text-gray-400">Введи название и цену сам</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* URL mode */}
        {mode === 'url' && (
          <>
            <button onClick={() => setMode('choose')} className="mb-4 text-sm text-gray-400 hover:text-gray-600">
              ← Назад
            </button>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Добавить по ссылке</h2>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrapePreview()}
              placeholder="https://www.wildberries.ru/..."
              autoFocus
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-300"
            />
            <p className="mt-2 text-xs text-gray-400">
              Мы попытаемся автоматически загрузить фото, название и цену
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600"
              >
                Отмена
              </button>
              <button
                onClick={handleScrapePreview}
                disabled={!url.trim() || scraping}
                className="flex-1 rounded-2xl bg-brand-500 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-brand-600 transition"
              >
                {scraping ? 'Загружаем...' : 'Далее →'}
              </button>
            </div>
          </>
        )}

        {/* Manual form */}
        {mode === 'manual' && (
          <>
            <button onClick={() => setMode(scraped ? 'url' : 'choose')} className="mb-4 text-sm text-gray-400 hover:text-gray-600">
              ← Назад
            </button>
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {scraped ? 'Проверь данные' : 'Добавить вручную'}
            </h2>

            {scraped?.imageUrl && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scraped.imageUrl}
                  alt="preview"
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="text-xs text-gray-500">
                  <p className="font-medium text-gray-700 line-clamp-2">{scraped.title}</p>
                  {scraped.siteName && <p>{scraped.siteName}</p>}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={manual.name}
                onChange={(e) => setManual((p) => ({ ...p, name: e.target.value }))}
                placeholder="Название *"
                className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              />
              <input
                type="text"
                value={manual.description}
                onChange={(e) => setManual((p) => ({ ...p, description: e.target.value }))}
                placeholder="Описание (необязательно)"
                className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={manual.price}
                  onChange={(e) => setManual((p) => ({ ...p, price: e.target.value }))}
                  placeholder="Цена"
                  className="flex-1 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                />
                <select
                  value={manual.currency}
                  onChange={(e) => setManual((p) => ({ ...p, currency: e.target.value }))}
                  className="rounded-2xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                >
                  <option value="RUB">₽</option>
                  <option value="USD">$</option>
                  <option value="EUR">€</option>
                  <option value="GBP">£</option>
                </select>
              </div>
              <input
                type="url"
                value={manual.sourceUrl}
                onChange={(e) => setManual((p) => ({ ...p, sourceUrl: e.target.value }))}
                placeholder="Ссылка (необязательно)"
                className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600">
                Отмена
              </button>
              <button
                onClick={handleAddManual}
                disabled={!manual.name.trim() || loading}
                className="flex-1 rounded-2xl bg-brand-500 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-brand-600 transition"
              >
                {loading ? 'Добавляем...' : 'Добавить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
