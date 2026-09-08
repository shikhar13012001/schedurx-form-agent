'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as api from '@/lib/api-client'
import { formatReviewDate } from './IntakeForm'

export interface PendingBookingPayViewProps {
  clinicId: string
  pendingBookingId: string
  initial: api.PendingBooking
}

// Reached via the SMS/WhatsApp link a receptionist's token-payment booking
// sends (schedurx-backend's api-v1-appointments.js) — the patient pays here,
// on our own domain, rather than a raw Stripe URL dropped into a message.
// No Appointment row exists until this succeeds and Stripe's webhook
// confirms it (see finalizePendingBooking) — so success/cancel both redirect
// back to THIS page (not the appointment manage page) to avoid a race where
// the webhook hasn't landed yet when the patient's browser returns.
export default function PendingBookingPayView({ clinicId, pendingBookingId, initial }: PendingBookingPayViewProps) {
  const searchParams = useSearchParams()
  const justPaid = searchParams.get('paid') === '1'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { status, clinic, doctor, timeslot, amountPaise, patientName } = initial
  const amountRupees = Math.round(amountPaise / 100)

  async function payNow() {
    setBusy(true)
    setError('')
    try {
      const origin = window.location.origin
      const base = `${origin}/${clinicId}/pay/${pendingBookingId}`
      const { checkoutUrl } = await api.createPendingBookingCheckoutSession(clinicId, pendingBookingId, `${base}?paid=1`, `${base}?paid=0`)
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-sx-canvas px-3 py-4">
      <div className="mx-auto max-w-[440px]">
        <div className="overflow-hidden rounded-[32px] shadow-[0_1px_2px_rgba(24,24,24,0.02),0_16px_44px_rgba(24,24,24,0.07)]">
          <div className="bg-sx-charcoal px-5 py-4 text-white">
            <p className="text-base font-medium leading-tight tracking-[-0.01em]">{clinic?.name ?? 'ScheduRx'}</p>
            {doctor && <p className="mt-0.5 text-xs text-white/60">Dr. {doctor.fullName}</p>}
          </div>

          <div className="bg-sx-white px-5 pb-6 pt-5">
            {justPaid || status === 'completed' ? (
              <div className="py-4 text-center">
                <h1 className="mb-2 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
                  Payment received
                </h1>
                <p className="text-sm text-sx-muted">Your appointment is confirmed. You&apos;ll get a WhatsApp message with the details shortly.</p>
              </div>
            ) : status === 'expired' ? (
              <div className="py-4 text-center">
                <h1 className="mb-2 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
                  This link has expired
                </h1>
                <p className="text-sm text-sx-muted">The held slot was released. Please contact {clinic?.name ?? 'the clinic'} to book again.</p>
              </div>
            ) : status === 'cancelled' ? (
              <div className="py-4 text-center">
                <h1 className="mb-2 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
                  Booking cancelled
                </h1>
                <p className="text-sm text-sx-muted">This booking is no longer awaiting payment.</p>
              </div>
            ) : (
              <div>
                <h1 className="mb-4 text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
                  Complete your booking
                </h1>

                <div className="mb-5 overflow-hidden rounded-[22px] border border-sx-stone-100">
                  {[
                    { label: 'Patient', value: patientName ?? '—' },
                    { label: 'Doctor', value: doctor ? `Dr. ${doctor.fullName}` : '—' },
                    { label: 'Clinic', value: clinic?.name ?? '—' },
                    { label: 'Time', value: timeslot ? formatReviewDate(timeslot) : 'To be confirmed' },
                    { label: 'Amount due', value: `₹${amountRupees}` },
                  ].map((row, i, arr) => (
                    <div key={i} className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-sx-stone-100' : ''}`}>
                      <span className="shrink-0 pt-0.5 text-xs text-sx-muted">{row.label}</span>
                      <span className="text-right text-sm text-sx-charcoal">{row.value}</span>
                    </div>
                  ))}
                </div>

                <p className="mb-4 text-xs text-sx-muted">This slot is held for you but not yet confirmed — pay to lock it in.</p>

                {error && <p className="mb-3 rounded-[16px] bg-sx-danger-soft px-3 py-2 text-center text-xs text-sx-danger">{error}</p>}

                {/* Pay now is the single climactic action of this entire page —
                    the only orange full-width surface, deliberately. */}
                <button
                  type="button"
                  onClick={payNow}
                  disabled={busy}
                  className="min-h-[56px] w-full rounded-full bg-sx-orange px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-sx-orange-deep disabled:opacity-60"
                >
                  {busy ? 'Redirecting to payment…' : `Pay ₹${amountRupees} now`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
