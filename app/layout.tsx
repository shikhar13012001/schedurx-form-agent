import type { Metadata } from 'next'
import './globals.css'

// metadataBase lets every page's relative OG image URL (app/opengraph-image.tsx)
// resolve to an absolute one — required for WhatsApp/social link previews,
// which fetch the image directly rather than rendering the page.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://schedurx-form-agent.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ScheduRx — Book your appointment',
  description: 'Book a clinic appointment quickly and easily.',
  openGraph: {
    title: 'ScheduRx — Book your appointment',
    description: 'Choose a doctor, pick a time, and confirm your visit in under a minute.',
    siteName: 'ScheduRx',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScheduRx — Book your appointment',
    description: 'Choose a doctor, pick a time, and confirm your visit in under a minute.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
