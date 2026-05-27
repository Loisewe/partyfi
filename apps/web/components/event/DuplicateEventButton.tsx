'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

function isoLocalDefault(srcStartsAt: string): string {
  // Default: same calendar day next year, same time
  const d = new Date(srcStartsAt)
  d.setFullYear(d.getFullYear() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DuplicateEventButton({ event }: { event: OwnerEvent }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [newDate, setNewDate] = useState<string>(isoLocalDefault(event.startsAt))
  const [busy, setBusy] = useState(false)

  async function duplicate() {
    setBusy(true)
    try {
      const result = await eventsApi.duplicate(
        event.id,
        { startsAt: new Date(newDate).toISOString() },
        { editToken: getEditToken(event.id) },
      )
      if (result.editToken) {
        localStorage.setItem(`wishly_event_edit_${result.event.id}`, result.editToken)
      }
      toast.show('Ивент скопирован', 'success')
      router.push(`/e/${result.event.shareToken}/host`)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не удалось скопировать', 'error')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="pill-secondary text-sm">
        📋 Скопировать ивент
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-ink-900/60 mb-2">
        Новая дата
      </p>
      <input
        type="datetime-local"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-ink-900 focus:outline-none focus:ring-4 focus:ring-ink-900/5 text-sm"
      />
      <p className="text-xs text-ink-900/50 mt-1.5">
        Скопируется всё: название, место, описание, обложка, вишлист. PIN и кастомный URL не копируются.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={duplicate} disabled={busy} className="pill-primary text-sm flex-1 disabled:opacity-60">
          {busy ? 'Копируем…' : 'Создать копию'}
        </button>
        <button onClick={() => setOpen(false)} className="pill-secondary text-sm">
          Отмена
        </button>
      </div>
    </div>
  )
}
