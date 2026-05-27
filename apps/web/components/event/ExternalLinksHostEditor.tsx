'use client'

import { useState, useEffect } from 'react'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'
import { ExternalLinksEditor, type ExternalLink } from './ExternalLinksEditor'

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

export function ExternalLinksHostEditor({
  event,
  onUpdated,
}: {
  event: OwnerEvent
  onUpdated: () => void
}) {
  const toast = useToast()
  const [links, setLinks] = useState<ExternalLink[]>(
    (event.externalLinks ?? []) as ExternalLink[],
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setLinks((event.externalLinks ?? []) as ExternalLink[])
    setDirty(false)
  }, [event.externalLinks])

  const maxLinks = event.isPremium ? 10 : 3

  function onChange(next: ExternalLink[]) {
    setLinks(next)
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      // Strip blank entries
      const cleaned = links.filter((l) => l.title.trim() && l.url.trim())
      await eventsApi.update(
        event.id,
        { externalLinks: cleaned },
        { editToken: getEditToken(event.id) },
      )
      toast.show(cleaned.length === 0 ? 'Ссылки убраны' : `Сохранили — ${cleaned.length}`, 'success')
      setDirty(false)
      onUpdated()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <ExternalLinksEditor value={links} onChange={onChange} maxLinks={maxLinks} />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="pill bg-ink-900 text-white text-sm w-full disabled:opacity-50"
        >
          {saving ? 'Сохраняем…' : 'Сохранить ссылки'}
        </button>
      )}
    </div>
  )
}
