import { notFound } from 'next/navigation'
import { EventPublicView } from './EventPublicView'

export const revalidate = 30

async function fetchEvent(tokenOrSlug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
  const res = await fetch(`${apiUrl}/events/${tokenOrSlug}`, { cache: 'no-store' })
  if (res.status === 404) return null
  return res.json()
}

export default async function EventPage({ params }: { params: { tokenOrSlug: string } }) {
  const data = await fetchEvent(params.tokenOrSlug)
  if (!data) notFound()
  return <EventPublicView initialData={data} tokenOrSlug={params.tokenOrSlug} />
}

export async function generateMetadata({ params }: { params: { tokenOrSlug: string } }) {
  const data = await fetchEvent(params.tokenOrSlug)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const ogUrl = `${base}/og/event/${params.tokenOrSlug}`

  if (!data) return { title: 'Ивент · Partyfi' }

  if (data.requiresPin) {
    return {
      metadataBase: new URL(base),
      title: `${data.preview?.title ?? 'Закрытый ивент'} · Partyfi`,
      description: 'Приглашение на закрытый ивент',
      openGraph: {
        type: 'website',
        title: data.preview?.title ?? 'Закрытый ивент',
        description: 'Защищён PIN',
        url: `${base}/e/${params.tokenOrSlug}`,
        images: [{ url: ogUrl, width: 1200, height: 630, alt: data.preview?.title ?? 'Ивент' }],
        locale: 'ru_RU',
      },
      twitter: {
        card: 'summary_large_image',
        title: data.preview?.title ?? 'Закрытый ивент',
        images: [ogUrl],
      },
    }
  }

  const description = data.description ?? `Приглашение на ${data.title}`

  return {
    metadataBase: new URL(base),
    title: `${data.title} · Partyfi`,
    description,
    openGraph: {
      type: 'website',
      title: data.title,
      description,
      url: `${base}/e/${params.tokenOrSlug}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: data.title }],
      locale: 'ru_RU',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description,
      images: [ogUrl],
    },
  }
}
