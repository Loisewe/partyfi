'use client'

import { useCallback, useState } from 'react'
import type { PublicEvent, EventPinPreview } from '@wishly/shared'
import { PinGate } from './PinGate'
import { RsvpForm } from './RsvpForm'
import { GuestList } from './GuestList'
import { useEventStream } from '@/lib/use-event-stream'
import { eventsApi } from '@/lib/api-client'
import { CoverImage } from '@/components/event/CoverImage'
import { PhotoWall } from '@/components/event/PhotoWall'
import { Countdown } from '@/components/ui/Countdown'
import { useToast } from '@/components/ui/Toast'

interface Props {
  initialData: PublicEvent | { requiresPin: true; preview: EventPinPreview }
  tokenOrSlug: string
}

function pluralizeItem(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'товар'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара'
  return 'товаров'
}

export function EventPublicView({ initialData, tokenOrSlug }: Props) {
  const toast = useToast()
  const [pin, setPin] = useState<string | undefined>()
  const [event, setEvent] = useState<PublicEvent | null>(
    'requiresPin' in initialData ? null : initialData,
  )
  const pinPreview = 'requiresPin' in initialData ? initialData.preview : null

  const refresh = useCallback(async () => {
    const refreshed = await eventsApi.get(tokenOrSlug, { pin })
    if (!('requiresPin' in refreshed)) setEvent(refreshed as PublicEvent)
  }, [tokenOrSlug, pin])

  useEventStream(event ? tokenOrSlug : undefined, refresh)

  async function onPinSubmit(submittedPin: string) {
    const refreshed = await eventsApi.get(tokenOrSlug, { pin: submittedPin })
    if ('requiresPin' in refreshed) {
      throw new Error('Неверный PIN')
    }
    setPin(submittedPin)
    setEvent(refreshed as PublicEvent)
  }

  if (!event) {
    if (!pinPreview) return null
    return <PinGate preview={pinPreview} onPinSubmit={onPinSubmit} />
  }

  if (event.status === 'CANCELLED') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-rose-50 to-gray-50">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">😞</div>
          <h1 className="font-display text-3xl font-bold mb-2 text-ink-900 line-through opacity-60">
            {event.title}
          </h1>
          <p className="text-rose-700 font-medium mb-3">Ивент отменён</p>
          {event.cancelMessage && (
            <p className="text-ink-900/60 italic">«{event.cancelMessage}»</p>
          )}
          <a href="/" className="mt-8 inline-block text-sm text-ink-900/50 underline">
            На главную
          </a>
        </div>
      </main>
    )
  }

  const startsAt = new Date(event.startsAt)
  const dateStr = startsAt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const hostName = event.host.name ?? event.host.nickname ?? 'хост'

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: event!.title, url })
        return
      } catch {
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.show('Ссылка скопирована', 'success')
    } catch {
      // ignore
    }
  }

  return (
    <main className="relative bg-gradient-to-b from-cream-50 via-white to-white min-h-screen pb-16">
      {/* Hero blob backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative container mx-auto max-w-2xl px-4 pt-6 sm:pt-10">
        {/* Hero cover */}
        <div className="relative animate-slide-up">
          <CoverImage
            imageUrl={event.coverImageUrl}
            coverPresetSlug={event.coverPresetSlug}
            className="w-full aspect-[16/10] sm:aspect-[2/1] rounded-3xl sm:rounded-4xl shadow-lifted overflow-hidden"
          />
          {event.isPremium && (
            <div className="absolute top-4 right-4 glass rounded-full px-3 py-1.5 text-xs font-bold text-ink-900 flex items-center gap-1">
              ⭐ Premium
            </div>
          )}
        </div>

        {/* Title block */}
        <header className="mt-6 sm:mt-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">
            Приглашение от {hostName}
          </p>
          <h1 className="font-display text-display-lg text-balance text-ink-900">
            {event.title}
          </h1>
        </header>

        {/* Meta row */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-parent">
          <div className="rounded-2xl glass p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg shrink-0">
              📅
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-900 truncate">{dateStr}</div>
              <div className="text-xs text-ink-900/60">
                <Countdown to={event.startsAt} prefix="в" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl glass p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-lg shrink-0">
              ⏰
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink-900">Начало в {timeStr}</div>
              <div className="text-xs text-ink-900/60">
                {event.timezone === 'Europe/Moscow' ? 'Москва' : event.timezone}
              </div>
            </div>
          </div>
        </div>

        {event.location && (
          <div className="mt-3 rounded-2xl glass p-4 flex items-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg shrink-0">
              📍
            </div>
            <div className="min-w-0 flex-1">
              {event.locationLink ? (
                <a
                  href={event.locationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-ink-900 hover:text-brand-500 transition truncate block"
                >
                  {event.location} <span className="text-xs">↗</span>
                </a>
              ) : (
                <div className="text-sm font-semibold text-ink-900 truncate">{event.location}</div>
              )}
              <div className="text-xs text-ink-900/60">Место встречи</div>
            </div>
          </div>
        )}

        {event.description && (
          <div className="mt-4 text-ink-900/80 leading-relaxed whitespace-pre-wrap animate-slide-up" style={{ animationDelay: '0.25s' }}>
            {event.description}
          </div>
        )}

        {/* Wishlist callout */}
        {event.wishlist && (
          <a
            href={`/w/${event.wishlist.shareToken}`}
            className="mt-6 group block rounded-3xl bg-gradient-cream-coral p-5 sm:p-6 shadow-soft hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-300 animate-slide-up"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl shrink-0 group-hover:rotate-12 transition-transform">🎁</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-900/70 mb-1">
                  Список желаний хоста
                </p>
                <p className="font-display text-xl font-bold text-ink-900 truncate">
                  {event.wishlist.name}
                </p>
                <p className="text-xs text-ink-900/60 mt-0.5">
                  {event.wishlist.itemCount} {pluralizeItem(event.wishlist.itemCount)} · посмотреть и забронировать →
                </p>
              </div>
            </div>
          </a>
        )}

        {/* RSVP form */}
        <section className="mt-8 rounded-3xl bg-white border border-gray-100 p-5 sm:p-7 shadow-soft animate-slide-up" style={{ animationDelay: '0.35s' }}>
          <RsvpForm tokenOrSlug={tokenOrSlug} pin={pin} />
        </section>

        {/* Guests */}
        <section className="mt-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <GuestList
            tokenOrSlug={tokenOrSlug}
            pin={pin}
            stats={event.rsvpStats}
            visibility={event.rsvpVisibility}
          />
        </section>

        {/* Photo wall */}
        <section className="mt-10 animate-slide-up" style={{ animationDelay: '0.45s' }}>
          <PhotoWall eventId={event.id} tokenOrSlug={tokenOrSlug} />
        </section>

        {/* Footer actions */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-100">
          <a
            href={eventsApi.icalUrl(tokenOrSlug)}
            className="inline-flex items-center gap-2 text-sm text-ink-900/60 hover:text-ink-900 transition"
          >
            <span>📅</span> Добавить в календарь
          </a>
          <button onClick={share} className="pill-secondary">
            <span>📤</span> Поделиться
          </button>
        </footer>

        <p className="mt-8 text-center text-xs text-ink-900/30">
          Создано с <span className="text-brand-500">♥</span> на{' '}
          <a href="/" className="font-semibold text-ink-900/50 hover:text-ink-900 underline">
            Partyfi
          </a>
        </p>
      </div>
    </main>
  )
}
