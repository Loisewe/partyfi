'use client'

import { useEffect, useState } from 'react'

interface Props {
  hasRsvpd: boolean
  onScrollToRsvp: () => void
}

/**
 * Mobile-only sticky bottom bar нудж к RSVP когда юзер ещё не ответил.
 * Hides когда юзер уже ответил, scrolled below the RSVP section, or viewport >= md.
 */
export function StickyRsvpBar({ hasRsvpd, onScrollToRsvp }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (hasRsvpd) {
      setVisible(false)
      return
    }
    let lastY = 0
    function onScroll() {
      const y = window.scrollY
      const direction = y - lastY
      lastY = y
      // Show only after scrolling past first ~600px (past cover + title)
      // Hide on fast scroll down to avoid flashing
      setVisible(y > 600 && direction <= 0)
    }
    setVisible(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasRsvpd])

  if (hasRsvpd || !visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden pointer-events-none">
      <div className="m-3 pointer-events-auto">
        <button
          onClick={onScrollToRsvp}
          className="w-full rounded-2xl px-4 py-3.5 text-white font-bold text-sm bg-gradient-celebratory shadow-lifted active:scale-95 transition"
        >
          🎉 Ответить — Иду / Может быть / Не смогу
        </button>
      </div>
    </div>
  )
}
