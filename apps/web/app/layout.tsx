import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ToastProvider } from '@/components/ui/Toast'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#ff2d7b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: {
    default: 'Partyfi — карточка ивента с RSVP и подарками',
    template: '%s | Partyfi',
  },
  description:
    'Собери гостей и подарки на одной странице. RSVP, вишлист, фото-стенка, напоминания — всё через Telegram без приложений.',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: process.env.NEXT_PUBLIC_WEB_URL ?? 'https://partyfi.app',
    siteName: 'Partyfi',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Partyfi — одна карточка для твоего ивента',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-white antialiased">
        <Providers>
          <ToastProvider>
            {children}
          </ToastProvider>
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
