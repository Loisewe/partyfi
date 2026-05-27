'use client'

import { useState } from 'react'

const SLUG_GRADIENT: Record<string, string> = {
  birthday: 'from-pink-300 to-yellow-200',
  housewarming: 'from-green-200 to-emerald-300',
  party: 'from-violet-400 to-fuchsia-300',
  wedding: 'from-rose-200 to-amber-100',
  'baby-shower': 'from-sky-200 to-pink-200',
}

const OCCASION_EMOJI: Record<string, string> = {
  birthday: '🎂',
  housewarming: '🏠',
  party: '🎉',
  wedding: '💍',
  'baby-shower': '👶',
}

function classifyCover(slug: string | null): { gradient: string; emoji: string } {
  if (!slug) return { gradient: 'from-slate-200 to-slate-100', emoji: '🎁' }
  for (const key of Object.keys(SLUG_GRADIENT)) {
    if (slug.startsWith(key)) {
      return { gradient: SLUG_GRADIENT[key]!, emoji: OCCASION_EMOJI[key] ?? '🎁' }
    }
  }
  return { gradient: 'from-slate-200 to-slate-100', emoji: '🎁' }
}

/**
 * Cover image with graceful fallback.
 * Renders a colored gradient + emoji as the BASE layer, and overlays the image
 * on top. If the image fails to load (404, network error), we hide it — the
 * gradient is exposed. No broken-image icon ever shows.
 */
export function CoverImage({
  imageUrl,
  coverPresetSlug,
  className = 'w-full h-48 rounded-2xl mb-6 overflow-hidden',
}: {
  imageUrl: string | null
  coverPresetSlug: string | null
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const { gradient, emoji } = classifyCover(coverPresetSlug)
  const showImage = !!imageUrl && !imgFailed

  return (
    <div className={`relative bg-gradient-to-br ${gradient} ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-6xl select-none">{emoji}</span>
      </div>
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  )
}
