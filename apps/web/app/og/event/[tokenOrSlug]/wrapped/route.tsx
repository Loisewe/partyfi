import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const revalidate = 1800

const size = { width: 1080, height: 1920 } as const

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

const SLUG_GRADIENT: Record<string, [string, string]> = {
  birthday: ['#fbcfe8', '#fde68a'],
  housewarming: ['#bbf7d0', '#a7f3d0'],
  party: ['#c4b5fd', '#f0abfc'],
  wedding: ['#fecdd3', '#fef3c7'],
  'baby-shower': ['#bae6fd', '#fbcfe8'],
}

function gradientFor(slug: string | null | undefined): [string, string] {
  if (!slug) return ['#ffe4f0', '#fef3c7']
  for (const tag of Object.keys(SLUG_GRADIENT)) {
    if (slug.startsWith(tag)) return SLUG_GRADIENT[tag]!
  }
  return ['#ffe4f0', '#fef3c7']
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

  const [eventRes, photosRes] = await Promise.all([
    fetch(`${API_BASE}/events/${tokenOrSlug}`, { cache: 'no-store' }),
    fetch(`${API_BASE}/events/${tokenOrSlug}/photos`, { cache: 'no-store' }).catch(() => null),
  ])

  if (!eventRes.ok) return new Response('Not found', { status: 404 })
  const data = await eventRes.json()
  if ('requiresPin' in data) return new Response('PIN-protected', { status: 403 })

  const event = data
  const photos = photosRes && photosRes.ok ? (await photosRes.json()).photos.length : 0
  const totalAttended = event.rsvpStats.going + event.rsvpStats.plusOnesTotal
  const title = event.title ?? 'Ивент'
  const slug = event.coverPresetSlug ?? null
  const [from, to] = gradientFor(slug)

  const dateStr = event.startsAt
    ? new Date(event.startsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const fontText = `${title} ${dateStr} Event Gallery Wrapped Закончилось гости пришли фото моментов спасибо`
  let manropeBold: ArrayBuffer | null = null
  try {
    manropeBold = await loadCyrillicFont(fontText)
  } catch {
    /* fallback */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '100px 80px',
          background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
          fontFamily: manropeBold ? 'Manrope' : 'system-ui',
          color: '#0f0a1e',
        }}
      >
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ff2d7b 0%, #fb923c 60%, #fbbf24 100%)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 800 }}>Event Gallery</div>
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 100 }}>
          <div style={{ display: 'flex', fontSize: 28, opacity: 0.6, fontWeight: 800, letterSpacing: '0.1em' }}>
            ЗАКОНЧИЛОСЬ · {dateStr}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 24 ? 96 : 120,
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            marginTop: 120,
            flex: 1,
          }}
        >
          <StatRow value={String(totalAttended)} label="гостей пришло" emoji="🎉" />
          {photos > 0 && <StatRow value={String(photos)} label="фото моментов" emoji="📸" />}
          {event.rsvpStats.maybe > 0 && (
            <StatRow value={String(event.rsvpStats.maybe)} label="были под вопросом" emoji="🤔" />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 'auto',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              padding: '14px 28px',
              borderRadius: 999,
              background: 'rgba(15, 10, 30, 0.08)',
              opacity: 0.7,
            }}
          >
            Спасибо что были 💜
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
        'Cache-Control': 'public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}

function StatRow({ value, label, emoji }: { value: string; label: string; emoji: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
      <div style={{ display: 'flex', fontSize: 56, lineHeight: 1 }}>{emoji}</div>
      <div
        style={{
          display: 'flex',
          fontSize: 128,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, opacity: 0.6 }}>{label}</div>
    </div>
  )
}
