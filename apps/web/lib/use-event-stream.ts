'use client'

import { useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

const DEFAULT_EVENT_TYPES = [
  'rsvp.upserted',
  'rsvp.deleted',
  'event.updated',
  'event.cancelled',
] as const

export function useEventStream(
  tokenOrSlug: string | undefined,
  onMessage: () => void,
  eventTypes: readonly string[] = DEFAULT_EVENT_TYPES,
) {
  useEffect(() => {
    if (!tokenOrSlug) return
    const es = new EventSource(`${API_BASE}/events/${tokenOrSlug}/events`)
    es.onmessage = () => onMessage()
    const handlers = eventTypes.map((type) => {
      const fn = () => onMessage()
      es.addEventListener(type, fn)
      return [type, fn] as const
    })
    return () => {
      for (const [type, fn] of handlers) es.removeEventListener(type, fn)
      es.close()
    }
  }, [tokenOrSlug, onMessage, eventTypes])
}
