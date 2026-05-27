'use client'

import { useCallback, useEffect, useState } from 'react'
import { eventsApi } from '@/lib/api-client'
import { useTelegramWebApp } from '@/lib/use-telegram-webapp'
import type { PublicEventResponse, PublicEvent } from '@wishly/shared'
import { CoverImage } from '@/components/event/CoverImage'

export function TgEventView({ tokenOrSlug }: { tokenOrSlug: string }) {
  const { webApp } = useTelegramWebApp()
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [rsvpLoading, setRsvpLoading] = useState<'GOING' | 'MAYBE' | 'NOT_GOING' | null>(null)

  const load = useCallback(async () => {
    const data = (await eventsApi.get(tokenOrSlug)) as PublicEventResponse
    if (!('requiresPin' in data)) setEvent(data as PublicEvent)
  }, [tokenOrSlug])

  useEffect(() => { load() }, [load])

  const setRsvp = useCallback(async (status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    setRsvpLoading(status)
    try {
      await eventsApi.rsvp(tokenOrSlug, { status, plusOnes: 0 })
      webApp?.HapticFeedback?.notificationOccurred('success')
      await load()
    } catch (err) {
      webApp?.HapticFeedback?.notificationOccurred('error')
      console.error(err)
    } finally {
      setRsvpLoading(null)
    }
  }, [tokenOrSlug, webApp, load])

  if (!event) {
    return <div className="p-6 text-center text-sm text-gray-500">Загружаем ивент…</div>
  }

  const startsAt = new Date(event.startsAt)
  const dateStr = startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const hostName = event.host.name ?? event.host.nickname ?? 'хост'

  return (
    <main className="px-4 py-5">
      <CoverImage
        imageUrl={event.coverImageUrl}
        coverPresetSlug={event.coverPresetSlug}
        className="w-full aspect-[16/10] rounded-3xl mb-5 overflow-hidden shadow-soft"
      />

      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1.5">
        От {hostName}
      </p>
      <h1 className="font-display text-3xl font-extrabold text-balance text-ink-900 mb-3">{event.title}</h1>

      <div className="flex items-center gap-2 text-sm text-ink-900/70 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 font-medium">📅 {dateStr}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 font-medium">⏰ {timeStr}</span>
      </div>

      {event.location && (
        <p className="text-sm text-ink-900/80 mb-3 flex items-start gap-2">
          <span className="shrink-0">📍</span>
          <span>{event.location}</span>
        </p>
      )}

      {event.description && (
        <p className="text-sm text-ink-900/70 leading-relaxed whitespace-pre-wrap mb-5">{event.description}</p>
      )}

      {event.wishlist && (
        <a
          href={`/w/${event.wishlist.shareToken}`}
          className="block mb-5 rounded-2xl bg-gradient-cream-coral p-4 shadow-soft active:scale-[0.98] transition"
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl shrink-0">🎁</div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-base text-ink-900 truncate">{event.wishlist.name}</p>
              <p className="text-xs text-ink-900/60 mt-0.5">{event.wishlist.itemCount} желаний · открыть →</p>
            </div>
          </div>
        </a>
      )}

      {/* RSVP — big TG-native buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4 stagger-parent">
        <RsvpButton
          label="🎉 Иду"
          variant="primary"
          loading={rsvpLoading === 'GOING'}
          onClick={() => setRsvp('GOING')}
        />
        <RsvpButton
          label="🤔 Может"
          variant="secondary"
          loading={rsvpLoading === 'MAYBE'}
          onClick={() => setRsvp('MAYBE')}
        />
        <RsvpButton
          label="😔 Не могу"
          variant="tertiary"
          loading={rsvpLoading === 'NOT_GOING'}
          onClick={() => setRsvp('NOT_GOING')}
        />
      </div>

      <div className="rounded-2xl bg-gray-50 p-3 text-center text-sm text-ink-900/70">
        <span className="font-bold text-ink-900">{event.rsvpStats.going}</span> идут
        {event.rsvpStats.plusOnesTotal > 0 && <span> (+{event.rsvpStats.plusOnesTotal})</span>}
        {' · '}
        <span className="font-bold text-ink-900">{event.rsvpStats.maybe}</span> может
      </div>
    </main>
  )
}

function RsvpButton({
  label,
  variant,
  loading,
  onClick,
}: {
  label: string
  variant: 'primary' | 'secondary' | 'tertiary'
  loading: boolean
  onClick: () => void
}) {
  const cls =
    variant === 'primary'
      ? 'bg-gradient-celebratory text-white shadow-soft'
      : variant === 'secondary'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-gray-100 text-ink-900/70'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`py-3.5 rounded-2xl text-sm font-bold transition active:scale-95 disabled:opacity-50 ${cls}`}
    >
      {loading ? '…' : label}
    </button>
  )
}
