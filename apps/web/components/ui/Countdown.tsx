'use client'

import { useEffect, useState } from 'react'

function diff(target: Date): { d: number; h: number; m: number; s: number; isPast: boolean } {
  const now = new Date()
  let ms = target.getTime() - now.getTime()
  const isPast = ms < 0
  ms = Math.abs(ms)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return { d, h, m, s, isPast }
}

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function Countdown({ to, prefix = 'Через' }: { to: string | Date; prefix?: string }) {
  const target = typeof to === 'string' ? new Date(to) : to
  const [, force] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => force((v) => v + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const { d, h, m, isPast } = diff(target)

  if (isPast) {
    if (d === 0 && h === 0) {
      return <span className="font-medium text-coral-500">Идёт прямо сейчас</span>
    }
    if (d === 0) {
      return <span className="font-medium text-gray-600">Уже прошло {h} {pluralizeRu(h, 'час назад', 'часа назад', 'часов назад')}</span>
    }
    return (
      <span className="font-medium text-gray-500">
        Прошло {d} {pluralizeRu(d, 'день', 'дня', 'дней')} назад
      </span>
    )
  }

  if (d >= 1) {
    return (
      <span className="font-medium text-ink-900">
        {prefix} <span className="text-brand-500">{d}</span> {pluralizeRu(d, 'день', 'дня', 'дней')}
        {h > 0 && (
          <>
            {', '}
            <span className="text-brand-500">{h}</span> {pluralizeRu(h, 'час', 'часа', 'часов')}
          </>
        )}
      </span>
    )
  }

  if (h >= 1) {
    return (
      <span className="font-medium text-coral-500">
        {prefix} <span>{h}</span> {pluralizeRu(h, 'час', 'часа', 'часов')}
        {m > 0 && <>, {m} {pluralizeRu(m, 'минута', 'минуты', 'минут')}</>}
      </span>
    )
  }

  return (
    <span className="font-medium text-coral-500 animate-pulse">
      Скоро · через {Math.max(m, 1)} {pluralizeRu(m, 'минута', 'минуты', 'минут')}
    </span>
  )
}
