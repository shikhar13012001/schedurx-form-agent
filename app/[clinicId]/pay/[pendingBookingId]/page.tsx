import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import PendingBookingPayView from '@/components/intake/PendingBookingPayView'
import * as api from '@/lib/api-client'

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

type RouteParams = { clinicId: string; pendingBookingId: string }

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { clinicId, pendingBookingId } = await params
  try {
    const pending = await api.getPendingBooking(clinicId, pendingBookingId)
    const title = pending.clinic ? `Complete your booking — ${pending.clinic.name}` : 'Complete your booking'
    return { title, description: 'Pay to confirm your appointment.' }
  } catch {
    return {}
  }
}

export default async function PendingBookingPage({ params }: { params: Promise<RouteParams> }) {
  const { clinicId, pendingBookingId } = await params

  let pending: api.PendingBooking
  try {
    pending = await api.getPendingBooking(clinicId, pendingBookingId)
  } catch {
    notFound()
  }

  return (
    <div className={`${dmSerif.variable} ${dmSans.variable}`}>
      <PendingBookingPayView clinicId={clinicId} pendingBookingId={pendingBookingId} initial={pending} />
    </div>
  )
}
