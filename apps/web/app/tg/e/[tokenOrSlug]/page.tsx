import { TgEventView } from './TgEventView'

interface Props {
  params: { tokenOrSlug: string }
}

export default function TgEventPage({ params }: Props) {
  return <TgEventView tokenOrSlug={params.tokenOrSlug} />
}

export const metadata = { title: 'Ивент · Partyfi' }
