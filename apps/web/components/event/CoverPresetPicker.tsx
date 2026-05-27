'use client'

import { useEffect, useState } from 'react'
import { eventsApi } from '@/lib/api-client'

export type CoverPreset = {
  id: string
  slug: string
  imageUrl: string
  occasionTags: string[]
}

const OCCASION_EMOJI: Record<string, string> = {
  birthday: '🎂',
  housewarming: '🏠',
  party: '🎉',
  wedding: '💍',
  'baby-shower': '👶',
  kids: '🧸',
  summer: '🌴',
  minimal: '◽',
  casual: '🍹',
}

const SLUG_GRADIENT: Record<string, string> = {
  birthday: 'from-pink-300 to-yellow-200',
  housewarming: 'from-green-200 to-emerald-300',
  party: 'from-violet-400 to-fuchsia-300',
  wedding: 'from-rose-200 to-amber-100',
  'baby-shower': 'from-sky-200 to-pink-200',
}

function gradientFor(preset: CoverPreset): string {
  for (const tag of preset.occasionTags) {
    if (SLUG_GRADIENT[tag]) return SLUG_GRADIENT[tag]
  }
  return 'from-slate-300 to-slate-200'
}

function emojiFor(preset: CoverPreset): string {
  for (const tag of preset.occasionTags) {
    if (OCCASION_EMOJI[tag]) return OCCASION_EMOJI[tag]
  }
  return '🎁'
}

function titleFor(preset: CoverPreset): string {
  return preset.slug
    .split('-')
    .slice(1)
    .join(' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || preset.slug
}

export function CoverPresetPicker({
  selectedId,
  onChange,
}: {
  selectedId: string | null
  onChange: (id: string | null) => void
}) {
  const [presets, setPresets] = useState<CoverPreset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
    fetch(`${base}/event-cover-presets`)
      .then((r) => r.ok ? r.json() : { presets: [] })
      .catch(() => ({ presets: [] }))
      .then((d: { presets: CoverPreset[] }) => {
        setPresets(d.presets ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-sm text-gray-500">Загружаем обложки…</div>
  }

  if (presets.length === 0) {
    return <div className="text-sm text-gray-500">Обложки пока недоступны.</div>
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`aspect-[3/2] rounded-lg border-2 flex items-center justify-center text-xs ${
            selectedId === null ? 'border-black' : 'border-transparent bg-gray-50'
          }`}
        >
          Без обложки
        </button>
        {presets.map((preset) => {
          const isSelected = selectedId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={`aspect-[3/2] rounded-lg border-2 overflow-hidden relative bg-gradient-to-br ${gradientFor(preset)} ${
                isSelected ? 'border-black ring-2 ring-black/20' : 'border-transparent'
              }`}
              title={titleFor(preset)}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl">{emojiFor(preset)}</span>
                <span className="text-[10px] text-white/90 mt-1 px-1 text-center font-medium drop-shadow-sm">
                  {titleFor(preset)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
