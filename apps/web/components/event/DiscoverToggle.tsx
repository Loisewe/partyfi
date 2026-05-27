'use client'

import { useState, useEffect } from 'react'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

function getEditToken(eventId: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(`wishly_event_edit_${eventId}`) ?? undefined
}

export function DiscoverToggle({ event, onUpdated }: { event: OwnerEvent; onUpdated: () => void }) {
  const toast = useToast()
  const [enabled, setEnabled] = useState(event.isDiscoverable)
  const [city, setCity] = useState(event.discoveryCity ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEnabled(event.isDiscoverable)
    setCity(event.discoveryCity ?? '')
  }, [event.isDiscoverable, event.discoveryCity])

  async function save(nextEnabled: boolean, nextCity: string) {
    setSaving(true)
    try {
      await eventsApi.update(
        event.id,
        {
          isDiscoverable: nextEnabled,
          discoveryCity: nextEnabled && nextCity.trim() ? nextCity.trim() : null,
        },
        { editToken: getEditToken(event.id) },
      )
      toast.show(nextEnabled ? 'Ивент попал в /discover' : 'Скрыт из /discover', 'success')
      onUpdated()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
      setEnabled(event.isDiscoverable)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => {
            setEnabled(e.target.checked)
            save(e.target.checked, city)
          }}
          className="mt-0.5 w-4 h-4 accent-brand-500"
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink-900">
            Показывать в открытом feed (/discover)
          </span>
          <span className="block text-xs text-ink-900/60 mt-0.5">
            Кто угодно сможет найти твой ивент через каталог. Адрес не показываем — только город.
          </span>
        </span>
      </label>

      {enabled && (
        <div>
          <label className="block text-xs font-medium text-ink-900/60 mb-1.5">Город</label>
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value.slice(0, 80))}
              onBlur={() => save(true, city)}
              placeholder="Москва, Питер, Берлин..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
            />
            {city !== (event.discoveryCity ?? '') && (
              <button
                onClick={() => save(true, city)}
                disabled={saving}
                className="pill bg-ink-900 text-white text-xs disabled:opacity-50"
              >
                Сохранить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
