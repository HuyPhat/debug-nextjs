import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Header } from '@/components/Header'
import { PreferencesProvider } from '@/components/PreferencesProvider'
import { PromoBanner } from '@/components/PromoBanner'
import { VitalsHUD } from '@/components/VitalsHUD'
import { getProfile } from '@/lib/db'
import type { Currency } from '@/lib/types'
import './globals.css'

// Prices and stock change all the time, so never serve anything stale.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Hydra Store',
  description: 'Slow fashion, made in Saigon.',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const cookieStore = await cookies()
  const profile = await getProfile(cookieStore.get('name')?.value)
  const currency: Currency = cookieStore.get('currency')?.value === 'USD' ? 'USD' : 'VND'

  return (
    <html lang="en">
      <head>
        <script src="/vendor/analytics.js"></script>
      </head>
      <body>
        <PreferencesProvider currency={currency}>
          <Header profile={profile} />
          <PromoBanner />
          <main className="container">{children}</main>
          <footer className="site-footer">
            <div className="container">© 2026 Hydra Store — a deliberately broken Next.js demo.</div>
          </footer>
        </PreferencesProvider>
        <VitalsHUD />
      </body>
    </html>
  )
}
