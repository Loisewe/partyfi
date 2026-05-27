import { HostDashboard } from './HostDashboard'

export const metadata = {
  title: 'Управление ивентом · Wishly',
}

export default function HostPage({ params }: { params: { tokenOrSlug: string } }) {
  return <HostDashboard tokenOrSlug={params.tokenOrSlug} />
}
