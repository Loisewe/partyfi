import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const revalidate = 3600

// Telegram Story format: 1080 × 1920 vertical
const size = { width: 1080, height: 1920 } as const

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

const SLUG_GRADIENT: Record<string, [string, string]> = {
  birthday: ['#fbcfe8', '#fde68a'],
  housewarming: ['#bbf7d0', '#a7f3d0'],
  party: ['#c4b5fd', '#f0abfc'],
  wedding: ['#fecdd3', '#fef3c7'],
  'baby-shower': ['#bae6fd', '#fbcfe8'],
}

const OCCASION_EMOJI: Record<string, string> = {
  birthday: '🎂',
  housewarming: '🏠',
  party: '🎉',
  wedding: '💍',
  'baby-shower': '👶',
}

// Default celebratory gradient (light enough for dark text)
const DEFAULT_GRADIENT: [string, string] = ['#ffe4f0', '#fef3c7']

function gradientFor(slug: string | null | undefined): [string, string] {
  if (!slug) return DEFAULT_GRADIENT
  for (const tag of Object.keys(SLUG_GRADIENT)) {
    if (slug.startsWith(tag)) return SLUG_GRADIENT[tag]!
  }
  return DEFAULT_GRADIENT
}

function emojiFor(slug: string | null | undefined): string {
  if (!slug) return '🎁'
  for (const tag of Object.keys(OCCASION_EMOJI)) {
    if (slug.startsWith(tag)) return OCCASION_EMOJI[tag]!
  }
  return '🎁'
}

async function loadCyrillicFont(text: string): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Manrope:wght@800&subset=cyrillic&text=${encodeURIComponent(text)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  ).then((r) => r.text())
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
  if (!url) throw new Error('Font URL not found')
  return fetch(url).then((r) => r.arrayBuffer())
}

export async function GET(
  _req: Request,
  { params }: { params: { tokenOrSlug: string } },
) {
  const { tokenOrSlug } = params

  const res = await fetch(`${API_BASE}/events/${tokenOrSlug}`, { cache: 'no-store' })
  if (!res.ok) return new Response('Not found', { status: 404 })
  const data = await res.json()

  const isPinGated = 'requiresPin' in data && data.requiresPin === true
  const event = isPinGated ? data.preview : data
  const title = event.title ?? 'Ивент'
  const hostName = event.hostName ?? event.host?.name ?? event.host?.nickname ?? ''
  const startsAt = event.startsAt ? new Date(event.startsAt) : null
  const dateStr = startsAt
    ? startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : ''
  const timeStr = startsAt
    ? startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : ''
  const slug = event.coverPresetSlug ?? null
  const [from, to] = gradientFor(slug)
  const emoji = emojiFor(slug)

  const fontText = `${title} ${hostName} ${dateStr} ${timeStr} Event Gallery от приглашаю на закрытый ивент`
  let manropeBold: ArrayBuffer | null = null
  try {
    manropeBold = await loadCyrillicFont(fontText)
  } catch {
    // fallback to system font
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '120px 80px',
          background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
          fontFamily: manropeBold ? 'Manrope' : 'system-ui',
          color: '#0f0a1e',
        }}
      >
        {/* Top brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ff2d7b 0%, #fb923c 60%, #fbbf24 100%)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#0f0a1e' }}>
            Event Gallery
          </div>
        </div>

        {/* Centerpiece */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          <div style={{ fontSize: 260, lineHeight: 1, display: 'flex' }}>{emoji}</div>
          {isPinGated && (
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, opacity: 0.7 }}>
              🔒 Закрытый ивент
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 24 ? 96 : 128,
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              textAlign: 'center',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </div>
          {hostName && (
            <div style={{ display: 'flex', fontSize: 40, opacity: 0.7 }}>
              от {hostName}
            </div>
          )}
        </div>

        {/* Bottom date */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {dateStr && (
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>
              {dateStr} · {timeStr}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              opacity: 0.6,
              fontWeight: 700,
              background: 'rgba(15, 10, 30, 0.08)',
              padding: '14px 28px',
              borderRadius: 999,
            }}
          >
            Открыть в Event Gallery →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: manropeBold
        ? [{ name: 'Manrope', data: manropeBold, style: 'normal', weight: 800 }]
        : [],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
