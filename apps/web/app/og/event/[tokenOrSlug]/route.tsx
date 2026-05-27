import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const revalidate = 3600

const size = { width: 1200, height: 630 } as const

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

const OCCASION_EMOJI: Record<string, string> = {
  birthday: '🎂',
  housewarming: '🏠',
  party: '🎉',
  wedding: '💍',
  'baby-shower': '👶',
  kids: '🧸',
  summer: '🌴',
  minimal: '◽',
  casual: '🍹',
}

const SLUG_GRADIENT: Record<string, [string, string]> = {
  birthday: ['#fbcfe8', '#fde68a'],
  housewarming: ['#bbf7d0', '#a7f3d0'],
  party: ['#c4b5fd', '#f0abfc'],
  wedding: ['#fecdd3', '#fef3c7'],
  'baby-shower': ['#bae6fd', '#fbcfe8'],
}

function gradientFor(slug: string | null | undefined): [string, string] {
  if (!slug) return ['#0f172a', '#1e293b']
  for (const tag of Object.keys(SLUG_GRADIENT)) {
    if (slug.startsWith(tag)) return SLUG_GRADIENT[tag]!
  }
  return ['#0f172a', '#1e293b']
}

function emojiFor(slug: string | null | undefined): string {
  if (!slug) return '🎁'
  for (const tag of Object.keys(OCCASION_EMOJI)) {
    if (slug.startsWith(tag)) return OCCASION_EMOJI[tag]!
  }
  return '🎁'
}

async function loadCyrillicFont(text: string): Promise<ArrayBuffer> {
  // Use Google Fonts CSS API with cyrillic subset + only-needed-glyphs trick.
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@700&subset=cyrillic&text=${encodeURIComponent(text)}`,
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
  if (!res.ok) {
    return new Response('Not found', { status: 404 })
  }
  const data = await res.json()

  // If PIN-protected, use preview data and a sealed look
  const isPinGated = 'requiresPin' in data && data.requiresPin === true
  const event = isPinGated ? data.preview : data
  const title = event.title ?? 'Ивент'
  const hostName = event.hostName ?? event.host?.name ?? event.host?.nickname ?? ''
  const startsAt = event.startsAt ? new Date(event.startsAt) : null
  const dateStr = startsAt
    ? startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const slug = event.coverPresetSlug ?? null
  const [from, to] = gradientFor(slug)
  const emoji = emojiFor(slug)

  const fontText = `${title} ${hostName} ${dateStr} Partyfi ${isPinGated ? 'Закрытый ивент' : ''} от`
  let interBold: ArrayBuffer | null = null
  try {
    interBold = await loadCyrillicFont(fontText)
  } catch {
    // fallback: render without custom font (Satori has a default that handles Latin)
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
          padding: '80px',
          background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
          fontFamily: interBold ? 'Inter' : 'system-ui',
          color: '#1e293b',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 28, opacity: 0.7, fontWeight: 700 }}>
            Partyfi
          </div>
          <div style={{ display: 'flex', fontSize: 96 }}>{emoji}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isPinGated && (
            <div style={{ display: 'flex', fontSize: 24, opacity: 0.7, fontWeight: 700 }}>
              🔒 Закрытый ивент
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 30 ? 64 : 80,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: '100%',
            }}
          >
            {title}
          </div>
          {hostName && (
            <div style={{ display: 'flex', fontSize: 32, opacity: 0.7 }}>
              от {hostName}
            </div>
          )}
          {dateStr && (
            <div style={{ display: 'flex', fontSize: 32, opacity: 0.85, fontWeight: 700 }}>
              {dateStr}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: interBold
        ? [{ name: 'Inter', data: interBold, style: 'normal', weight: 700 }]
        : [],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
