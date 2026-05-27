'use client'

import { useState } from 'react'

interface Props {
  location: string
  locationLink: string | null
}

/**
 * Lightweight Yandex Maps embed.
 * Renders a Y.Maps widget iframe with the location text as the search query.
 * Hidden until the user explicitly expands it (avoids loading a heavy iframe
 * on every event view).
 */
export function MapEmbed({ location, locationLink }: Props) {
  const [expanded, setExpanded] = useState(false)

  const yandexSearch = encodeURIComponent(location)
  const widgetUrl = `https://yandex.ru/map-widget/v1/?text=${yandexSearch}&z=14`
  const fallbackUrl = locationLink ?? `https://yandex.ru/maps/?text=${yandexSearch}`

  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-sm font-semibold text-ink-900 text-left flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span>🗺</span>
            Показать на карте
          </span>
          <span className="text-ink-900/40 text-xs">↓</span>
        </button>
      ) : (
        <>
          <iframe
            src={widgetUrl}
            className="w-full h-64 sm:h-72 border-0"
            loading="lazy"
            title={`Карта: ${location}`}
            allow="geolocation"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 hover:underline"
            >
              Открыть в Я.Картах ↗
            </a>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-ink-900/50 hover:text-ink-900 underline"
            >
              Свернуть
            </button>
          </div>
        </>
      )}
    </div>
  )
}
