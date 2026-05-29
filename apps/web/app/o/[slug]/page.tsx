import { notFound } from 'next/navigation'
import { OrgPublicView } from './OrgPublicView'

export const revalidate = 60

async function fetchOrg(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
  const [orgRes, eventsRes] = await Promise.all([
    fetch(`${apiUrl}/organizations/${slug}`, { cache: 'no-store' }),
    fetch(`${apiUrl}/organizations/${slug}/events?tense=upcoming&limit=24`, { cache: 'no-store' }),
  ])
  if (orgRes.status === 404) return null
  const [org, events] = await Promise.all([orgRes.json(), eventsRes.ok ? eventsRes.json() : { events: [] }])
  return { org, events }
}

export default async function OrgPage({ params }: { params: { slug: string } }) {
  const data = await fetchOrg(params.slug)
  if (!data) notFound()
  return <OrgPublicView slug={params.slug} initialData={data} />
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await fetchOrg(params.slug)
  if (!data) return { title: 'Организация не найдена · Event Gallery' }
  const o = data.org.organization
  return {
    title: `${o.name} · Event Gallery`,
    description: o.tagline ?? o.description ?? `Ивенты ${o.name}`,
    openGraph: {
      title: o.name,
      description: o.tagline ?? o.description ?? '',
      images: o.coverImageUrl ? [o.coverImageUrl] : [],
    },
  }
}
