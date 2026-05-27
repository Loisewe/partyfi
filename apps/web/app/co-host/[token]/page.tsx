import { CoHostAcceptClient } from './CoHostAcceptClient'

export const metadata = { title: 'Приглашение co-host · Partyfi' }

export default function CoHostAcceptPage({ params }: { params: { token: string } }) {
  return <CoHostAcceptClient token={params.token} />
}
