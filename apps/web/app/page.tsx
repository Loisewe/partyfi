import Link from 'next/link'
import { CreateWishlistButton } from '@/components/wishlist/CreateWishlistButton'
import { Header } from '@/components/layout/Header'

export default function LandingPage() {
  return (
    <main className="relative bg-white">
      <Header showCreate={false} />

      {/* ─── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Blob backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] hero-blob pointer-events-none" aria-hidden />

        <div className="relative container mx-auto max-w-5xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white shadow-soft px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-500 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-ring" />
            Без регистрации · Бесплатно
          </div>

          <h1 className="font-display text-display-xl text-balance text-ink-900 max-w-4xl mx-auto animate-slide-up">
            Собирай гостей{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-celebratory bg-clip-text text-transparent">
                и подарки
              </span>
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-brand-200"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 4 Q 25 1 50 4 T 100 4" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </span>
            <br />в одном месте
          </h1>

          <p className="mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-ink-900/60 text-pretty animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Создай ивент за минуту: дата, место, вишлист. Гости RSVP-ят в один тап,
            хост видит счёт онлайн, всё через Telegram.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link
              href="/create-event"
              className="pill-brand text-base px-7 py-3.5"
            >
              🎉 Создать ивент
            </Link>
            <CreateWishlistButton />
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-ink-900/50 hover:text-ink-900 transition px-3 py-3"
            >
              Как это работает ↓
            </Link>
          </div>

          {/* Mini event preview card — visual anchor */}
          <div className="mt-16 sm:mt-20 mx-auto max-w-md text-left animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="relative rounded-3xl bg-white shadow-lifted overflow-hidden border border-gray-100">
              <div className="h-32 sm:h-40 bg-gradient-to-br from-pink-300 to-yellow-200 relative">
                <div className="absolute inset-0 flex items-center justify-center text-5xl">🎂</div>
                <div className="absolute top-3 right-3 glass rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900">
                  ⭐ Premium
                </div>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">Приглашение от Маши</p>
                <h3 className="font-display text-2xl font-bold text-ink-900 mb-2">Днюха в субботу</h3>
                <p className="text-xs text-ink-900/60 mb-4">15 июня · через 3 дня · Москва</p>

                <div className="flex items-center gap-2 mb-4">
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-300 to-orange-300 ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center">АН</div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-300 to-pink-300 ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center">ПК</div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-300 to-teal-300 ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center">+5</div>
                  </div>
                  <span className="text-xs text-ink-900/60">7 идут</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="py-2 rounded-xl bg-gradient-celebratory text-white text-xs font-bold text-center">🎉 Иду</div>
                  <div className="py-2 rounded-xl border border-gray-200 text-ink-900/60 text-xs font-bold text-center">🤔</div>
                  <div className="py-2 rounded-xl border border-gray-200 text-ink-900/60 text-xs font-bold text-center">😔</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative bg-gradient-to-b from-cream-50 to-white px-6 py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">
              Как это работает
            </p>
            <h2 className="font-display text-display-md text-balance text-ink-900">
              Три шага до отправки приглашения
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3 stagger-parent">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-3xl bg-white p-7 shadow-soft hover:shadow-lifted hover:-translate-y-1 transition-all duration-300 border border-gray-50">
                <div className="absolute top-6 right-6 font-display text-5xl font-extrabold text-brand-50 select-none">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="text-4xl mb-4">{s.emoji}</div>
                <h3 className="font-display text-xl font-bold text-ink-900 mb-2">{s.title}</h3>
                <p className="text-sm text-ink-900/60 text-pretty">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use cases (events + wishlists) ─────────────────────────────────── */}
      <section className="px-6 py-24 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">
              Для чего
            </p>
            <h2 className="font-display text-display-md text-balance text-ink-900">
              Один продукт.
              <br />
              <span className="text-brand-500">Все ваши поводы.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {USE_CASES.map((u) => (
              <div
                key={u.title}
                className={`rounded-3xl p-7 border border-transparent transition-all duration-300 hover:-translate-y-1 ${u.bg}`}
              >
                <div className="text-4xl mb-4">{u.emoji}</div>
                <h3 className="font-display text-2xl font-bold text-ink-900 mb-2">{u.title}</h3>
                <p className="text-sm text-ink-900/70 text-pretty">{u.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Telegram CTA ───────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-gradient-soft">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="inline-block mb-6 animate-bounce-soft">
            <svg className="h-16 w-16 mx-auto" viewBox="0 0 24 24" fill="#229ED9">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.46 13.563l-2.98-.924c-.648-.204-.66-.648.136-.958l11.647-4.49c.54-.194 1.013.131.631.03z"/>
            </svg>
          </div>
          <h2 className="font-display text-display-md text-balance text-ink-900 mb-4">
            Живёт прямо в Telegram
          </h2>
          <p className="text-lg text-ink-900/60 mb-8 text-pretty">
            Mini App вместо ещё одного приложения. RSVP, фото, оплата премиума —
            всё в один тап, без выхода из чата.
          </p>
          <a
            href="https://t.me/Event GalleryBot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#229ED9] px-7 py-3.5 text-base font-bold text-white shadow-lifted hover:-translate-y-0.5 transition-all"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.46 13.563l-2.98-.924c-.648-.204-.66-.648.136-.958l11.647-4.49c.54-.194 1.013.131.631.03z"/>
            </svg>
            Открыть @Event GalleryBot
          </a>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <div className="container mx-auto max-w-2xl">
          <h2 className="font-display text-display-md text-balance text-ink-900 mb-4">
            Готов собрать всех?
          </h2>
          <p className="text-lg text-ink-900/60 mb-8">Создай первый ивент — займёт минуту.</p>
          <Link href="/create-event" className="pill-brand text-base px-8 py-4">
            🎉 Создать ивент
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-ink-900/40">
        © {new Date().getFullYear()} Event Gallery · Сделано с{' '}
        <span className="text-brand-500">♥</span>
        {' · '}
        <Link href="/terms" className="hover:text-ink-900/60 transition">Условия</Link>
        {' · '}
        <Link href="/privacy" className="hover:text-ink-900/60 transition">Конфиденциальность</Link>
      </footer>
    </main>
  )
}

const STEPS = [
  {
    emoji: '✨',
    title: 'Создай ивент',
    description:
      'Название, дата, место. Прикрепи вишлист — гости сразу увидят список желаний.',
  },
  {
    emoji: '💌',
    title: 'Кинь ссылку',
    description:
      'Шарь в Telegram-чат, WhatsApp или в сторис. Открывается в браузере и в TG Mini App.',
  },
  {
    emoji: '🎯',
    title: 'Считай гостей',
    description:
      'Все RSVP в реальном времени. Напоминания за 24 и 2 часа автоматически.',
  },
]

const USE_CASES = [
  {
    emoji: '🎂',
    title: 'День рождения',
    description: 'Прикрепи свой вишлист — гости забронируют подарок, никто не подарит одно и то же.',
    bg: 'bg-gradient-to-br from-pink-50 to-yellow-50',
  },
  {
    emoji: '🏠',
    title: 'Новоселье',
    description: 'Гости понимают что подарить и где встречаемся. Совместные подарки на крупное.',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
  },
  {
    emoji: '🥂',
    title: 'Просто тусовка',
    description: 'Бар, баня, пикник — обычный RSVP без вишлиста. Сколько придёт — видно сразу.',
    bg: 'bg-gradient-to-br from-violet-50 to-pink-50',
  },
  {
    emoji: '💍',
    title: 'Свадьба',
    description: 'Общий вишлист пары, RSVP с плюсванами, фото-стенка после праздника.',
    bg: 'bg-gradient-to-br from-rose-50 to-cream-100',
  },
]
