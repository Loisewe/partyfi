'use client'

import { useState } from 'react'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'

const SLUG_RE = /^[a-z0-9-]+$/

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

export function CustomSlugEditor({
  event,
  onUpdated,
}: {
  event: OwnerEvent
  onUpdated: () => void
}) {
  const [slug, setSlug] = useState(event.customSlug ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)

    const trimmed = slug.trim().toLowerCase()
    if (trimmed.length > 0) {
      if (trimmed.length < 3 || trimmed.length > 40) {
        setError('От 3 до 40 символов')
        return
      }
      if (!SLUG_RE.test(trimmed)) {
        setError('Только латиница, цифры и дефис')
        return
      }
    }

    setSaving(true)
    try {
      await eventsApi.update(
        event.id,
        { customSlug: trimmed === '' ? null : trimmed },
        { editToken: getEditToken(event.id) },
      )
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500 select-none whitespace-nowrap">partyfi.app/e/</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="ani-birthday"
          className="flex-1 min-w-0 px-2 py-1.5 border rounded-lg font-mono text-sm"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50"
        >
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs mt-1.5">{error}</p>}
      <p className="text-xs text-gray-500 mt-1.5">
        Запоминающийся URL вместо `cmpn...` — гости узнают по ссылке. Оставь пустым, чтобы убрать.
      </p>
    </div>
  )
}
