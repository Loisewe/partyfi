'use client'

import { useCallback, useEffect, useState } from 'react'
import { analyticsApi, type EventAnalytics } from '@/lib/api-client'

interface Props { eventId: string; editToken?: string; pollQuestion?: string | null }

export function AnalyticsPanel({ eventId, editToken, pollQuestion }: Props) {
  const [data, setData] = useState<EventAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await analyticsApi.forEvent(eventId, editToken)
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [eventId, editToken])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map((i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
      </div>
    )
  }

  if (!data) return null

  const conv = Math.round(data.summary.conversionViewToRsvp * 100)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Просмотры" value={data.summary.totalViews} />
        <Stat label="Уник. посет." value={data.summary.uniqueViewers} />
        <Stat label="Идут" value={data.summary.goingRsvps + data.summary.plusOnesTotal} accent="text-emerald-600" />
        <Stat label="Конверсия" value={`${conv}%`} sub="просмотр → RSVP" accent="text-brand-500" />
      </div>

      {data.viewsByDay.length > 1 && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-900/60 mb-3">
            👀 Просмотры по дням
          </h3>
          <BarChart data={data.viewsByDay.map((d) => ({ label: d.day.slice(5), value: d.count }))} />
        </div>
      )}

      {pollQuestion && data.pollBreakdown.length > 0 && (
        <div className="rounded-2xl bg-brand-50/50 border border-brand-100 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-700 mb-1">
            📊 Опрос
          </h3>
          <p className="text-sm font-semibold text-ink-900 mb-3">{pollQuestion}</p>
          <PollResults breakdown={data.pollBreakdown} />
        </div>
      )}

      {data.isLimitedByFreeTier && (
        <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-3 text-xs text-amber-900">
          ⭐ Free план: показаны только последние 7 дней. Премиум разблокирует историю целиком.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, accent = 'text-ink-900' }: {
  label: string
  value: number | string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-3 text-center">
      <div className={`font-display text-2xl sm:text-3xl font-extrabold ${accent} leading-none`}>
        {value}
      </div>
      <div className="text-[10px] sm:text-xs text-ink-900/60 mt-1 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-ink-900/40 mt-0.5">{sub}</div>}
    </div>
  )
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => {
        const h = (d.value / max) * 100
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="text-[9px] text-ink-900/60 font-bold tabular-nums">{d.value}</div>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-brand-300"
              style={{ height: `${Math.max(4, h)}%` }}
            />
            <div className="text-[9px] text-ink-900/40 font-mono">{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function PollResults({ breakdown }: { breakdown: Array<{ option: string; count: number }> }) {
  const total = breakdown.reduce((acc, b) => acc + b.count, 0) || 1
  return (
    <ul className="space-y-2">
      {breakdown.map((b) => {
        const pct = Math.round((b.count / total) * 100)
        return (
          <li key={b.option}>
            <div className="flex items-center justify-between text-xs font-medium text-ink-900 mb-1">
              <span>{b.option}</span>
              <span className="tabular-nums">{b.count} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-brand-100 overflow-hidden">
              <div className="h-full bg-gradient-celebratory" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
