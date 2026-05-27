'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OwnerEvent, PublicEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useEventStream } from '@/lib/use-event-stream'
import { UpgradeButton } from '@/components/event/UpgradeButton'
import { CustomSlugEditor } from '@/components/event/CustomSlugEditor'
import { DuplicateEventButton } from '@/components/event/DuplicateEventButton'
import { ShareToStoryButton } from '@/components/event/ShareToStoryButton'
import { RecurrenceEditor } from '@/components/event/RecurrenceEditor'

interface Props { tokenOrSlug: string }

function getStoredEditToken(eventId: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(`wishly_event_edit_${eventId}`)
}

export function HostDashboard({ tokenOrSlug }: Props) {
  const router = useRouter()
  const [event, setEvent] = useState<OwnerEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await eventsApi.get(tokenOrSlug)
      if ('requiresPin' in data) {
        setError('PIN-защищённый ивент — открой по основной ссылке')
        return
      }
      // Re-fetch with editToken if available — gives us OwnerEvent
      const maybeOwner = data as PublicEvent
      const token = getStoredEditToken(maybeOwner.id)
      if (token) {
        const withToken = await eventsApi.get(tokenOrSlug, { editToken: token })
        if (!('requiresPin' in withToken)) {
          setEvent(withToken as OwnerEvent)
          return
        }
      }
      // No editToken — check if user is auth-owner (server returns editToken in that case)
      if ('editToken' in maybeOwner) {
        setEvent(maybeOwner as OwnerEvent)
        return
      }
      setError('Ты не хост этого ивента (нет editToken в браузере)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    }
  }, [tokenOrSlug])

  useEffect(() => { load() }, [load])
  useEventStream(event ? tokenOrSlug : undefined, load)

  async function cancelEvent() {
    if (!event) return
    const editToken = getStoredEditToken(event.id) ?? undefined
    if (!cancelMessage.trim()) {
      alert('Укажи причину отмены')
      return
    }
    if (!confirm(`Отменить "${event.title}"?`)) return
    try {
      const updated = await eventsApi.cancel(event.id, { cancelMessage }, { editToken })
      setEvent(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отмены')
    }
  }

  async function copyInvite() {
    if (!event) return
    const url = `${window.location.origin}/e/${event.customSlug ?? event.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-600">{error}</p>
      </main>
    )
  }
  if (!event) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <p className="text-gray-500">Загружаем…</p>
      </main>
    )
  }

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/e/${event.customSlug ?? event.shareToken}`
    : ''

  const totalGoing = event.rsvpStats.going + event.rsvpStats.plusOnesTotal

  return (
    <main className="relative bg-gradient-to-b from-cream-50 via-white to-white min-h-screen pb-16">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative container mx-auto max-w-2xl px-4 pt-6 sm:pt-10">
        <button
          onClick={() => router.push(`/e/${tokenOrSlug}`)}
          className="text-sm text-ink-900/60 hover:text-ink-900 underline mb-6 transition"
        >
          ← Открыть как гость
        </button>

        {/* Title block */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
            Управление ивентом
          </p>
          <h1 className="font-display text-display-md text-balance text-ink-900 mb-2">{event.title}</h1>
          <p className="text-ink-900/60">
            {new Date(event.startsAt).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard label="Идут" value={totalGoing} accent="text-emerald-600" plus={event.rsvpStats.plusOnesTotal > 0 ? `+${event.rsvpStats.plusOnesTotal}` : null} />
          <StatCard label="Может" value={event.rsvpStats.maybe} accent="text-amber-600" />
          <StatCard label="Не смогут" value={event.rsvpStats.notGoing} accent="text-ink-900/50" />
        </div>

        {/* Upgrade banner */}
        <section className="mb-6">
          <UpgradeButton
            eventId={event.id}
            isPremium={event.isPremium}
            onUpgraded={load}
          />
        </section>

        {/* Premium-only sections */}
        {event.isPremium && (
          <>
            <section className="mb-6 rounded-3xl bg-white border border-gray-100 shadow-soft p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-ink-900 mb-3 flex items-center gap-2">
                <span>⭐</span> Кастомный URL
              </h2>
              <CustomSlugEditor event={event} onUpdated={load} />
            </section>

            <section className="mb-6 rounded-3xl bg-white border border-gray-100 shadow-soft p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-ink-900 mb-3 flex items-center gap-2">
                <span>🔁</span> Повторение
              </h2>
              <RecurrenceEditor event={event} onUpdated={load} />
            </section>
          </>
        )}

        {/* Share */}
        <section className="mb-6 rounded-3xl bg-white border border-gray-100 shadow-soft p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink-900 mb-3 flex items-center gap-2">
            <span>🔗</span> Поделиться
          </h2>
          <div className="flex gap-2">
            <input
              value={inviteUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-mono text-ink-900/70 min-w-0"
            />
            <button
              onClick={copyInvite}
              className="pill-primary whitespace-nowrap"
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ShareToStoryButton tokenOrSlug={tokenOrSlug} eventTitle={event.title} />
            <DuplicateEventButton event={event} />
          </div>
          <p className="text-xs text-ink-900/50 mt-3">
            {event.hasPinProtection ? '🔒 PIN-защита включена' : 'Без PIN — открыто по ссылке'}
            {' · '}Обновления в реальном времени
          </p>
        </section>

        {/* Cancel */}
        {event.status === 'ACTIVE' ? (
          <details className="rounded-3xl bg-rose-50/50 border border-rose-200/60 p-5 sm:p-6 group">
            <summary className="cursor-pointer flex items-center justify-between text-rose-900 font-semibold">
              <span className="flex items-center gap-2"><span>⚠️</span> Отменить ивент</span>
              <span className="text-rose-900/40 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-4">
              <textarea
                value={cancelMessage}
                onChange={(e) => setCancelMessage(e.target.value)}
                placeholder="Причина — увидят все гости"
                rows={2}
                className="w-full px-4 py-3 rounded-2xl border border-rose-200 bg-white focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10 resize-none transition"
              />
              <button
                onClick={cancelEvent}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-rose-700 transition"
              >
                Отменить и оповестить гостей
              </button>
            </div>
          </details>
        ) : (
          <div className="rounded-3xl bg-rose-50 border border-rose-200 p-5 text-center">
            <p className="text-rose-900 font-display font-bold text-lg mb-1">Ивент отменён</p>
            {event.cancelMessage && <p className="text-sm text-rose-900/70 italic">«{event.cancelMessage}»</p>}
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  accent,
  plus,
}: {
  label: string
  value: number
  accent: string
  plus?: string | null
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 text-center">
      <div className={`font-display text-4xl font-extrabold ${accent}`}>
        {value}
        {plus && <span className="text-lg font-bold text-ink-900/40 ml-1">{plus}</span>}
      </div>
      <div className="text-xs text-ink-900/60 mt-1 font-medium">{label}</div>
    </div>
  )
}
