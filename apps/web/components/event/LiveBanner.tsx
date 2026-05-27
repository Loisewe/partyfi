'use client'

import { useEffect, useState } from 'react'

interface Props {
  startsAt: string
  endsAt?: string | null
}

/**
 * Live status banner displayed above the cover.
 *
 * States:
 *   - far-future (>24h) → render nothing (Countdown handles the date pill area)
 *   - soon (<24h, >now) → "До начала: HHч MMм" pill
 *   - live (now between startsAt and endsAt or startsAt + 6h) → "🔴 Сейчас идёт" с pulse
 *   - finished → "Закончилось N часов / N дней назад"
 */
export function LiveBanner({ startsAt, endsAt }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const startMs = new Date(startsAt).getTime()
  const endMs = endsAt ? new Date(endsAt).getTime() : startMs + 6 * 60 * 60 * 1000

  // Finished
  if (now >= endMs) {
    const elapsed = now - endMs
    const days = Math.floor(elapsed / (24 * 60 * 60 * 1000))
    const hours = Math.floor((elapsed % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const label = days > 0
      ? `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`
      : hours > 0
      ? `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`
      : 'только что'
    return (
      <Banner tone="muted">
        <span className="text-base">✨</span>
        <span>Закончилось {label}</span>
      </Banner>
    )
  }

  // Live
  if (now >= startMs && now < endMs) {
    return (
      <Banner tone="live">
        <span className="relative flex h-3 w-3 mr-0.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span>Сейчас идёт</span>
      </Banner>
    )
  }

  // Far-future — don't render
  const ms = startMs - now
  if (ms > 24 * 60 * 60 * 1000) return null

  // Soon (<24h, >now)
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const label = h > 0 ? `${h} ч ${m > 0 ? `${m} мин` : ''}` : `${m} мин`

  return (
    <Banner tone="soon">
      <span>⏳</span>
      <span>Начнётся через {label.trim()}</span>
    </Banner>
  )
}

function Banner({ tone, children }: { tone: 'soon' | 'live' | 'muted'; children: React.ReactNode }) {
  const cls =
    tone === 'live'
      ? 'bg-red-500 text-white shadow-lifted'
      : tone === 'soon'
      ? 'bg-gradient-to-r from-amber-200 to-orange-200 text-amber-900'
      : 'bg-gray-100 text-ink-900/70'
  return (
    <div className="flex justify-center mb-4 animate-slide-up">
      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${cls}`}>
        {children}
      </div>
    </div>
  )
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
