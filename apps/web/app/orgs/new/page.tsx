import { CreateOrgForm } from './CreateOrgForm'

export const metadata = { title: 'Создать организацию · Event Gallery' }

export default function NewOrgPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 via-white to-white px-4 py-12">
      <div className="container mx-auto max-w-xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
            Для команд и организаторов
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight mb-2">
            Создай организацию
          </h1>
          <p className="text-sm text-ink-900/60">
            Объединяй ивенты под одним брендом — единая афиша на твоей странице, общий стиль обложек,
            команда с ролями. Подходит промо-командам, лекторам, конференциям.
          </p>
        </div>

        <CreateOrgForm />
      </div>
    </main>
  )
}
