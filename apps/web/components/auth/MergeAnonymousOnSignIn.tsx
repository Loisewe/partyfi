'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

// This component runs silently in the background.
// When a user signs in for the first time (status changes authenticated),
// it reads any editTokens from localStorage and calls the API to merge
// those anonymous wishlists into the now-authenticated account.

export function MergeAnonymousOnSignIn() {
  const { data: session, status } = useSession()
  const mergedRef = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || mergedRef.current) return

    const stored = localStorage.getItem('wishly_edit_tokens')
    if (!stored) return

    let editTokens: string[]
    try {
      editTokens = Object.values(JSON.parse(stored) as Record<string, string>)
    } catch {
      return
    }

    if (editTokens.length === 0) return

    mergedRef.current = true

    // Call the merge endpoint — fire and forget
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/auth/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ editTokens }),
    })
      .then((res) => {
        if (res.ok) {
          // Clear merged tokens so we don't try again
          localStorage.removeItem('wishly_edit_tokens')
        }
      })
      .catch(() => {
        // Non-critical — user can still see their anonymous wishlists via direct links
        mergedRef.current = false
      })
  }, [status, session])

  return null
}
