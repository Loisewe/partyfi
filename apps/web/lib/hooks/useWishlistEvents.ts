import { useEffect, useCallback } from 'react'
import type { WishlistItem } from '@wishly/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export interface WishlistEvent {
  type: 'ITEM_RESERVED' | 'ITEM_UNRESERVED'
  itemId: string
  reservationId: string
  isReserved: boolean
  allowJoining?: boolean
  reserverName?: string | null
}

interface Options {
  shareToken: string
  onEvent: (event: WishlistEvent) => void
  enabled?: boolean
}

// Subscribes to SSE stream for a wishlist's reservation updates.
// Automatically reconnects with exponential backoff on connection loss.
export function useWishlistEvents({ shareToken, onEvent, enabled = true }: Options) {
  const handleEvent = useCallback(onEvent, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || !shareToken) return
    if (typeof EventSource === 'undefined') return // SSR guard

    let es: EventSource | null = null
    let reconnectDelay = 1000
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let mounted = true

    function connect() {
      if (!mounted) return

      es = new EventSource(`${API_BASE}/wishlists/${shareToken}/events`, {
        withCredentials: true,
      })

      es.addEventListener('connected', () => {
        reconnectDelay = 1000 // reset backoff on successful connect
      })

      es.addEventListener('ITEM_RESERVED', (e: MessageEvent) => {
        try {
          handleEvent(JSON.parse(e.data) as WishlistEvent)
        } catch { /* ignore */ }
      })

      es.addEventListener('ITEM_UNRESERVED', (e: MessageEvent) => {
        try {
          handleEvent(JSON.parse(e.data) as WishlistEvent)
        } catch { /* ignore */ }
      })

      es.onerror = () => {
        es?.close()
        es = null

        if (mounted) {
          // Exponential backoff: 1s → 2s → 4s → 8s → max 30s
          reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
            connect()
          }, reconnectDelay)
        }
      }
    }

    connect()

    return () => {
      mounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [shareToken, handleEvent, enabled])
}
