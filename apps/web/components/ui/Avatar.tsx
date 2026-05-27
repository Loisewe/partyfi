'use client'

// Deterministic-color avatar derived from name/id.
// Falls back to gradient + initial when no image.

const PALETTE: [string, string][] = [
  ['from-rose-300', 'to-orange-300'],
  ['from-amber-300', 'to-pink-300'],
  ['from-violet-300', 'to-pink-300'],
  ['from-sky-300', 'to-violet-300'],
  ['from-emerald-300', 'to-teal-300'],
  ['from-fuchsia-300', 'to-rose-300'],
  ['from-orange-300', 'to-yellow-300'],
  ['from-blue-300', 'to-cyan-300'],
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
} as const

export function Avatar({
  name,
  src,
  seed,
  size = 'md',
  className = '',
}: {
  name: string | null | undefined
  src?: string | null
  seed?: string
  size?: keyof typeof SIZE_CLASSES
  className?: string
}) {
  const key = seed ?? name ?? ''
  const [from, to] = PALETTE[hashCode(key) % PALETTE.length]!
  const initials = initialsOf(name)

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name ?? ''}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover ring-2 ring-white shadow-sm ${className}`}
      />
    )
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br ${from} ${to} flex items-center justify-center font-bold text-white ring-2 ring-white shadow-sm ${className}`}
      aria-label={name ?? 'Аноним'}
    >
      {initials}
    </div>
  )
}

export function AvatarStack({
  people,
  max = 5,
  size = 'sm',
}: {
  people: Array<{ name: string | null; src?: string | null; seed?: string }>
  max?: number
  size?: keyof typeof SIZE_CLASSES
}) {
  const visible = people.slice(0, max)
  const extra = people.length - visible.length

  return (
    <div className="flex -space-x-2">
      {visible.map((p, i) => (
        <Avatar key={i} {...p} size={size} className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-gray-100 ring-2 ring-white text-ink-900 flex items-center justify-center font-semibold`}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
