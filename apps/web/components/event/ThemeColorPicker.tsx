'use client'

import { useState } from 'react'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

type ThemeColor = 'rose' | 'violet' | 'emerald' | 'amber' | 'sky' | 'slate'

const THEMES: Array<{ key: ThemeColor; label: string; swatchClass: string }> = [
  { key: 'rose',    label: 'Рассвет',   swatchClass: 'bg-gradient-to-br from-rose-300 to-amber-200' },
  { key: 'violet',  label: 'Фиалка',    swatchClass: 'bg-gradient-to-br from-violet-400 to-fuchsia-300' },
  { key: 'emerald', label: 'Лес',       swatchClass: 'bg-gradient-to-br from-emerald-300 to-lime-200' },
  { key: 'amber',   label: 'Закат',     swatchClass: 'bg-gradient-to-br from-amber-300 to-orange-400' },
  { key: 'sky',     label: 'Океан',     swatchClass: 'bg-gradient-to-br from-sky-300 to-indigo-300' },
  { key: 'slate',   label: 'Графит',    swatchClass: 'bg-gradient-to-br from-slate-700 to-slate-400' },
]

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

export function ThemeColorPicker({
  event,
  onUpdated,
}: {
  event: OwnerEvent
  onUpdated: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState<ThemeColor | 'clear' | null>(null)

  async function setTheme(themeColor: ThemeColor | null) {
    setSaving(themeColor ?? 'clear')
    try {
      await eventsApi.update(
        event.id,
        { themeColor },
        { editToken: getEditToken(event.id) },
      )
      toast.show(themeColor ? `Тема «${THEMES.find((t) => t.key === themeColor)?.label}»` : 'Тема убрана', 'success')
      onUpdated()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <p className="text-xs text-ink-900/60 mb-3">
        Выбери цветовую тему — она применится к фону, акцентам и кнопкам ивента.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          onClick={() => setTheme(null)}
          disabled={saving !== null}
          aria-pressed={event.themeColor === null}
          className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center text-[10px] font-semibold transition disabled:opacity-50 ${
            event.themeColor === null
              ? 'border-ink-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <span className="text-2xl">∅</span>
          <span className="mt-0.5 text-ink-900/70">Дефолт</span>
        </button>
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            disabled={saving !== null}
            aria-pressed={event.themeColor === t.key}
            className={`aspect-square rounded-2xl border-2 relative overflow-hidden transition disabled:opacity-50 ${
              event.themeColor === t.key
                ? 'border-ink-900 ring-2 ring-ink-900/20 scale-105'
                : 'border-transparent hover:scale-105'
            }`}
          >
            <div className={`absolute inset-0 ${t.swatchClass}`} />
            <span className="absolute bottom-1 left-0 right-0 text-[9px] font-bold text-white text-center drop-shadow-md">
              {t.label}
            </span>
            {saving === t.key && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                …
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
