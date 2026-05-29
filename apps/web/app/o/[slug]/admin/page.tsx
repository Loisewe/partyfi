import { OrgAdminShell } from './OrgAdminShell'

export const metadata = { title: 'Управление организацией · Event Gallery' }

export default function OrgAdminPage({ params }: { params: { slug: string } }) {
  return <OrgAdminShell slug={params.slug} />
}
