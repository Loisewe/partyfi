'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orgsApi } from '@/lib/api-client'

const SLUG_RE = /^[a-z0-9-]+$/

export function CreateOrgForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function autoSlug(value: string) {
    const cleaned = value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)
    setSlug(cleaned)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (slug.length < 3 || slug.length > 32 || !SLUG_RE.test(slug)) {
      setError('URL: 3-32 символа, латиница / цифры / дефис')
      return
    }
    if (name.trim().length === 0) {
      setError('Название обязательно')
      return
    }

    setBusy(true)
    try {
      const { organization } = await orgsApi.create({
        slug,
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
      })
      router.push(`/o/${organization.slug}/admin`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white border border-gray-100 shadow-soft p-6 sm:p-8">
      <div>
        <label className="block text-sm font-semibold text-ink-900 mb-1">Название</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slug) autoSlug(e.target.value)
          }}
          placeholder="Disco Club Moscow"
          maxLength={80}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-900 mb-1">URL</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">eventgallery.app/o/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="disco-club"
            maxLength={32}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono"
            required
          />
        </div>
        <p className="text-xs text-ink-900/50 mt-1">3-32 символа, латиница и дефисы. Не сменится потом.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-900 mb-1">Подзаголовок (опционально)</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Лучшие электронные вечеринки Москвы"
          maxLength={160}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-900 mb-1">О себе (опционально)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Промо-команда с 2018-го. Сцены: Mutabor, Powerhouse, Стелла Арт..."
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full pill bg-gradient-celebratory text-white text-sm font-semibold py-3 shadow-soft hover:shadow-lifted disabled:opacity-50"
      >
        {busy ? 'Создаём…' : 'Создать организацию →'}
      </button>

      <p className="text-xs text-ink-900/50 text-center pt-2">
        Бесплатный план: до 3 активных ивентов. Премиум-функции — после создания.
        <br />
        <Link href="/" className="underline">← Назад</Link>
      </p>
    </form>
  )
}
