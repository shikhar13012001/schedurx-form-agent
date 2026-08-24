import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: '400',
})

// metadataBase lets every page's relative OG image URL (app/opengraph-image.tsx)
// resolve to an absolute one — required for WhatsApp/social link previews,
// which fetch the image directly rather than rendering the page.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://schedurx-form-agent.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ScheduRX — Book your appointment',
  description: 'Book a clinic appointment quickly and easily.',
  openGraph: {
    title: 'ScheduRX — Book your appointment',
    description: 'Choose a doctor, pick a time, and confirm your visit in under a minute.',
    siteName: 'ScheduRX',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScheduRX — Book your appointment',
    description: 'Choose a doctor, pick a time, and confirm your visit in under a minute.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
