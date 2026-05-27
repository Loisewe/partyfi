'use client'

import { useState } from 'react'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

const OPTIONS: Array<{ value: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null; label: string; sub: string }> = [
  { value: null,      label: 'Не повторять', sub: 'Одноразовый ивент' },
  { value: 'WEEKLY',  label: 'Каждую неделю', sub: 'Книжный клуб, тренировка' },
  { value: 'MONTHLY', label: 'Каждый месяц',  sub: 'Pub-quiz, бранч' },
  { value: 'YEARLY',  label: 'Каждый год',    sub: 'День рождения' },
]

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

export function RecurrenceEditor({
  event,
  onUpdated,
}: {
  event: OwnerEvent
  onUpdated: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<typeof OPTIONS[number]['value'] | 'idle'>('idle')

  async function setRepeat(v: typeof OPTIONS[number]['value']) {
    if (v === event.repeatEvery) return
    setBusy(v)
    try {
      await eventsApi.update(event.id, { repeatEvery: v } as any, { editToken: getEditToken(event.id) })
      onUpdated()
      toast.show(v ? 'Повторение включено' : 'Повторение выключено', 'success')
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    } finally {
      setBusy('idle')
    }
  }

  return (
    <div className="space-y-2">
      {OPTIONS.map((o) => {
        const isSelected = event.repeatEvery === o.value
        const isLoading = busy === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => setRepeat(o.value)}
            disabled={busy !== 'idle'}
            className={`w-full text-left rounded-2xl border-2 p-3 transition active:scale-[0.99] disabled:opacity-60 ${
              isSelected
                ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                : 'border-gray-200 hover:border-ink-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-ink-900">{o.label}</div>
                <div className="text-xs text-ink-900/60">{o.sub}</div>
              </div>
              {isLoading ? (
                <span className="text-ink-900/40 text-xs">…</span>
              ) : isSelected ? (
                <span className="text-brand-600 text-lg">✓</span>
              ) : null}
            </div>
          </button>
        )
      })}
      <p className="text-xs text-ink-900/50 mt-2">
        После окончания ивента автоматически создастся копия с той же шапкой и вишлистом, но на новую дату.
      </p>
    </div>
  )
}
