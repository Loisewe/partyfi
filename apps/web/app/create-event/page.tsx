import { CreateEventForm } from './CreateEventForm'
import { Header } from '@/components/layout/Header'

export const metadata = {
  title: 'Создать ивент · Partyfi',
}

export default function CreateEventPage() {
  return (
    <main className="relative bg-gradient-to-b from-cream-50 via-white to-white min-h-screen pb-20">
      <Header showCreate={false} />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative container mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3 text-center">
          Новый ивент
        </p>
        <h1 className="font-display text-display-md text-balance text-center text-ink-900 mb-3">
          Расскажи о своём{' '}
          <span className="bg-gradient-celebratory bg-clip-text text-transparent">событии</span>
        </h1>
        <p className="text-center text-ink-900/60 mb-10 max-w-md mx-auto">
          Заполни базовые поля — детали можно править потом. Ссылку получишь сразу.
        </p>

        <div className="rounded-3xl bg-white shadow-lifted border border-gray-100 p-6 sm:p-8">
          <CreateEventForm />
        </div>
      </div>
    </main>
  )
}
