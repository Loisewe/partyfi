import { notFound } from 'next/navigation'
import { EmbedView } from './EmbedView'

export const revalidate = 60

async function fetchEvent(tokenOrSlug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
  const res = await fetch(`${apiUrl}/events/${tokenOrSlug}`, { cache: 'no-store' })
  if (res.status === 404) return null
  return res.json()
}

export default async function EmbedPage({ params }: { params: { tokenOrSlug: string } }) {
  const data = await fetchEvent(params.tokenOrSlug)
  if (!data) notFound()
  return <EmbedView initialData={data} tokenOrSlug={params.tokenOrSlug} />
}

export const metadata = {
  title: 'Event Gallery embed',
  // Permissive frame-ancestors to allow embedding on any site
  other: {
    'X-Frame-Options': 'ALLOWALL',
  },
}
