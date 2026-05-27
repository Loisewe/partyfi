import { HostDashboard } from './HostDashboard'

export const metadata = {
  title: 'Управление ивентом · Partyfi',
}

export default function HostPage({ params }: { params: { tokenOrSlug: string } }) {
  return <HostDashboard tokenOrSlug={params.tokenOrSlug} />
}
