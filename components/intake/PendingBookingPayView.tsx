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
    <div className="min-h-screen bg-gray-100 py-4 px-3" style={{ fontFamily: 'var(--font-dm-sans, system-ui, sans-serif)' }}>
      <div className="mx-auto max-w-[440px]">
        <div className="rounded-xl overflow-hidden shadow-sm">
          <div className="bg-[#0F6E56] px-4 py-3 text-white">
            <p className="font-semibold text-base leading-tight">{clinic?.name ?? 'ScheduRx'}</p>
            {doctor && <p className="text-xs text-white/70 mt-0.5">Dr. {doctor.fullName}</p>}
          </div>

          <div className="bg-white px-4 pt-5 pb-6">
            {justPaid || status === 'completed' ? (
              <div className="text-center py-4">
                <h1 className="text-xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}>
                  Payment received
                </h1>
                <p className="text-sm text-[#6b7280]">Your appointment is confirmed. You&apos;ll get a WhatsApp message with the details shortly.</p>
              </div>
            ) : status === 'expired' ? (
              <div className="text-center py-4">
                <h1 className="text-xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}>
                  This link has expired
                </h1>
                <p className="text-sm text-[#6b7280]">The held slot was released. Please contact {clinic?.name ?? 'the clinic'} to book again.</p>
              </div>
            ) : status === 'cancelled' ? (
              <div className="text-center py-4">
                <h1 className="text-xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}>
                  Booking cancelled
                </h1>
                <p className="text-sm text-[#6b7280]">This booking is no longer awaiting payment.</p>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-bold text-[#1a1a1a] mb-4" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}>
                  Complete your booking
                </h1>

                <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
                  {[
                    { label: 'Patient', value: patientName ?? '—' },
                    { label: 'Doctor', value: doctor ? `Dr. ${doctor.fullName}` : '—' },
                    { label: 'Clinic', value: clinic?.name ?? '—' },
                    { label: 'Time', value: timeslot ? formatReviewDate(timeslot) : 'To be confirmed' },
                    { label: 'Amount due', value: `₹${amountRupees}` },
                  ].map((row, i, arr) => (
                    <div key={i} className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <span className="text-xs text-[#6b7280] shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-sm text-[#1a1a1a] text-right">{row.value}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[#6b7280] mb-4">This slot is held for you but not yet confirmed — pay to lock it in.</p>

                {error && <p className="text-xs text-red-500 text-center mb-3 bg-red-50 rounded-lg py-2 px-3">{error}</p>}

                <button
                  type="button"
                  onClick={payNow}
                  disabled={busy}
                  className="w-full rounded-lg bg-[#EC6B25] px-4 py-3.5 text-sm font-semibold text-white min-h-12 disabled:opacity-60"
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
