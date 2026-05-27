'use client'

import { useCallback, useEffect, useState } from 'react'

interface LightboxPhoto {
  id: string
  url: string
  uploaderName?: string
}

export function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: LightboxPhoto[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)

  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length])
  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, next, prev])

  // Swipe support
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0]!.clientX)
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX == null) return
    const dx = e.changedTouches[0]!.clientX - touchStartX
    if (Math.abs(dx) > 60) {
      dx < 0 ? next() : prev()
    }
    setTouchStartX(null)
  }

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/95 backdrop-blur-md flex flex-col animate-fade-in"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium opacity-80">
          {index + 1} / {photos.length}
          {photo.uploaderName && <span className="ml-3 opacity-60">от {photo.uploaderName}</span>}
        </span>
        <button
          onClick={onClose}
          className="rounded-full w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 transition"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt=""
          className="max-h-full max-w-full object-contain rounded-xl shadow-lifted"
        />
      </div>

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center text-xl backdrop-blur-md"
            aria-label="Назад"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center text-xl backdrop-blur-md"
            aria-label="Вперёд"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
