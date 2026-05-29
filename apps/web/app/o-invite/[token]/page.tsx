import { OrgInviteAcceptClient } from './OrgInviteAcceptClient'

export const metadata = { title: 'Приглашение в команду · Event Gallery' }

export default function OrgInviteAcceptPage({ params }: { params: { token: string } }) {
  return <OrgInviteAcceptClient token={params.token} />
}
