import type { Metadata } from 'next'
import Script from 'next/script'
import { TgAppShell } from './TgAppShell'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Partyfi',
  description: 'Partyfi в Telegram',
}

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* TG WebApp SDK is provided by Telegram on the client. We just need the script tag. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TgAppShell>{children}</TgAppShell>
    </>
  )
}
