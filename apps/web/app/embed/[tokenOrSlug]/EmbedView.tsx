'use client'

import { useEffect, useRef } from 'react'
import type { PublicEvent, EventPinPreview } from '@wishly/shared'
import { CoverImage } from '@/components/event/CoverImage'
import { themeStyles } from '@/lib/event-theme'

interface Props {
  initialData: PublicEvent | { requiresPin: true; preview: EventPinPreview }
  tokenOrSlug: string
}

/**
 * Embed-friendly view: minimal chrome, no sticky elements, no nav,
 * auto-resize to content via postMessage to parent frame.
 *
 * Use as iframe src: <iframe src="partyfi.app/embed/{token}" />
 */
export function EmbedView({ initialData, tokenOrSlug }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Post height changes to parent so iframe can auto-resize
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined') return
    const post = () => {
      try {
        window.parent.postMessage(
          { type: 'partyfi:resize', height: root.scrollHeight },
          '*',
        )
      } catch { /* swallow */ }
    }
    post()
    const ro = new ResizeObserver(post)
    ro.observe(root)
    return () => ro.disconnect()
  }, [])

  if ('requiresPin' in initialData) {
    const preview = initialData.preview
    const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/e/${tokenOrSlug}`
    return (
      <div ref={rootRef} className="bg-white">
        <div className="p-4 sm:p-5 max-w-md">
          <CoverImage
            imageUrl={preview.coverImageUrl}
            coverPresetSlug={null}
            className="w-full aspect-[3/2] rounded-2xl overflow-hidden mb-3"
          />
          <h2 className="font-display font-bold text-ink-900 text-lg mb-1">
            🔒 {preview.title}
          </h2>
          <p className="text-sm text-ink-900/60 mb-3">
            от {preview.hostName ?? 'хоста'} · защищён PIN
          </p>
          <a
            href={eventUrl}
            target="_top"
            className="inline-flex items-center pill bg-ink-900 text-white text-sm"
          >
            Открыть и ввести PIN →
          </a>
        </div>
      </div>
    )
  }

  const event = initialData
  const theme = themeStyles(event.themeColor)
  const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/e/${event.customSlug ?? event.shareToken}`
  const startsAt = new Date(event.startsAt).toLocaleString('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return (
    <div
      ref={rootRef}
      className={`${theme.pageBg || 'bg-white'} font-sans p-4 sm:p-5 max-w-md`}
      style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
    >
      <CoverImage
        imageUrl={event.coverImageUrl}
        coverPresetSlug={event.coverPresetSlug}
        themeGradient={theme.coverGradient}
        className="w-full aspect-[16/10] rounded-2xl overflow-hidden mb-3"
      />

      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display font-extrabold text-ink-900 text-xl tracking-tight">
          {event.title}
        </h2>
        {event.isPremium && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            ⭐ премиум
          </span>
        )}
      </div>

      <p className="text-sm text-ink-900/70 mb-2">📅 {startsAt}</p>
      {event.location && (
        <p className="text-sm text-ink-900/70 mb-3">📍 {event.location}</p>
      )}

      <div className="flex items-center gap-2 mb-4 text-xs text-ink-900/60">
        <span className="font-semibold text-emerald-600">{event.rsvpStats.going} идут</span>
        {event.rsvpStats.plusOnesTotal > 0 && (
          <span className="text-emerald-600">+{event.rsvpStats.plusOnesTotal}</span>
        )}
        {event.rsvpStats.maybe > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600">{event.rsvpStats.maybe} может</span>
          </>
        )}
      </div>

      <a
        href={eventUrl}
        target="_top"
        className="block w-full text-center pill bg-gradient-celebratory text-white text-sm shadow-soft"
      >
        Подтвердить участие →
      </a>

      <p className="text-[10px] text-ink-900/30 text-center mt-3">
        powered by <a href={process.env.NEXT_PUBLIC_SITE_URL} target="_top" className="underline">Partyfi</a>
      </p>
    </div>
  )
}
