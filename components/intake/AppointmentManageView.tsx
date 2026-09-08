'use client'

import { useEffect, useState } from 'react'
import * as api from '@/lib/api-client'
import { SlotStep, PrimaryBtn, formatReviewDate } from './IntakeForm'
import type { Doctor, Slot } from './IntakeForm'

export interface AppointmentManageViewProps {
  clinicId: string
  appointmentId: string
  initial: api.AppointmentSummary
}

// The confirmation/manage page opened from a booking-confirmation WhatsApp
// message's link — same clinicId+appointmentId capability model as the
// backend route it calls (see api-v1-public.js), no separate patient login.
export default function AppointmentManageView({ clinicId, appointmentId, initial }: AppointmentManageViewProps) {
  const [summary, setSummary] = useState(initial)
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [schedulerConfigured, setSchedulerConfigured] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [commsLinks, setCommsLinks] = useState<api.CommsLinks | null>(null)

  const { appointment, doctor, clinic } = summary
  const isBooked = appointment.status === 'booked'

  // Best-effort — a clinic with no review link or no WhatsApp sender
  // configured yet just gets fewer CTAs, not an error on the page.
  useEffect(() => {
    api
      .getCommsLinks(clinicId, appointmentId)
      .then(setCommsLinks)
      .catch(() => setCommsLinks(null))
  }, [clinicId, appointmentId])

  function fetchSlotsForDate(dateStr: string) {
    if (!doctor) return
    setSelectedDate(dateStr)
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    api
      .getSlots(clinicId, doctor.id, dateStr)
      .then((data) => {
        setSlots(data.slots)
        setSchedulerConfigured(data.schedulerConfigured)
      })
      .catch(() => { setSlots([]); setSchedulerConfigured(false) })
      .finally(() => setSlotsLoading(false))
  }

  async function confirmReschedule() {
    if (!selectedSlot) return
    setBusy(true)
    setError('')
    try {
      await api.rescheduleAppointment(clinicId, appointmentId, selectedSlot)
      const fresh = await api.getAppointment(clinicId, appointmentId)
      setSummary(fresh)
      setMode('view')
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCancel() {
    if (!window.confirm('Cancel this appointment? This cannot be undone.')) return
    setBusy(true)
    setError('')
    try {
      await api.cancelAppointment(clinicId, appointmentId)
      const fresh = await api.getAppointment(clinicId, appointmentId)
      setSummary(fresh)
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const doctorForSlotStep: Doctor | null = doctor ? { ...doctor, avatarUrl: null } : null

  return (
    <div className="min-h-screen bg-sx-canvas px-3 py-4">
      <div className="mx-auto max-w-[440px]">
        <div className="overflow-hidden rounded-[32px] shadow-[0_1px_2px_rgba(24,24,24,0.02),0_16px_44px_rgba(24,24,24,0.07)]">
          <div className="bg-sx-charcoal px-5 py-4 text-white">
            <p className="text-base font-medium leading-tight tracking-[-0.01em]">{clinic.name}</p>
            {doctor && <p className="mt-0.5 text-xs text-white/60">Dr. {doctor.fullName}</p>}
          </div>

          <div className="bg-sx-white px-5 pb-6 pt-5">
            {mode === 'view' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h1 className="text-xl font-medium tracking-[-0.02em] text-sx-charcoal">
                    Your appointment
                  </h1>
                  <StatusBadge status={appointment.status} />
                </div>

                <div className="mb-5 overflow-hidden rounded-[22px] border border-sx-stone-100">
                  {[
                    { label: 'Doctor', value: doctor ? `Dr. ${doctor.fullName}${doctor.specialty ? ` · ${doctor.specialty}` : ''}` : '—' },
                    { label: 'Clinic', value: clinic.name },
                    { label: 'Time', value: appointment.timeslot ? formatReviewDate(appointment.timeslot) : 'To be confirmed' },
                    ...(appointment.symptoms ? [{ label: 'Symptoms', value: appointment.symptoms }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-sx-stone-100' : ''}`}>
                      <span className="shrink-0 pt-0.5 text-xs text-sx-muted">{row.label}</span>
                      <span className="text-right text-sm text-sx-charcoal">{row.value}</span>
                    </div>
                  ))}
                </div>

                {error && <p className="mb-3 rounded-[16px] bg-sx-danger-soft px-3 py-2 text-center text-xs text-sx-danger">{error}</p>}

                {isBooked && (commsLinks?.textCommsUrl || commsLinks?.reviewUrl) && (
                  <div className="mb-3 flex gap-2">
                    {commsLinks.textCommsUrl && (
                      <a
                        href={commsLinks.textCommsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 rounded-[16px] border border-sx-orange/20 bg-sx-orange-tint px-3 py-2.5 text-center text-sm font-medium text-sx-orange-deep"
                      >
                        Message us
                      </a>
                    )}
                    {commsLinks.reviewUrl && (
                      <a
                        href={commsLinks.reviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 rounded-[16px] border border-sx-stone-200 px-3 py-2.5 text-center text-sm font-medium text-sx-charcoal"
                      >
                        Leave a review
                      </a>
                    )}
                  </div>
                )}

                {isBooked && (
                  <div className="space-y-3">
                    <PrimaryBtn onClick={() => setMode('reschedule')} disabled={busy}>
                      Reschedule
                    </PrimaryBtn>
                    <button
                      type="button"
                      onClick={confirmCancel}
                      disabled={busy}
                      className="min-h-[56px] w-full rounded-full border border-sx-danger/25 px-6 py-3.5 text-sm font-medium text-sx-danger transition-colors hover:bg-sx-danger-soft disabled:opacity-60"
                    >
                      Cancel appointment
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === 'reschedule' && doctorForSlotStep && (
              <div>
                {error && <p className="mb-3 rounded-[16px] bg-sx-danger-soft px-3 py-2 text-center text-xs text-sx-danger">{error}</p>}
                <SlotStep
                  doctor={doctorForSlotStep}
                  selectedDate={selectedDate}
                  onDateChange={fetchSlotsForDate}
                  slots={slots}
                  loading={slotsLoading}
                  schedulerConfigured={schedulerConfigured}
                  selected={selectedSlot}
                  onSelect={setSelectedSlot}
                  onBack={() => { setMode('view'); setError('') }}
                  onContinue={confirmReschedule}
                />
                {busy && <p className="mt-3 text-center text-xs text-sx-muted">Saving…</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    booked: 'bg-sx-success-soft text-sx-success',
    cancelled: 'bg-sx-danger-soft text-sx-danger',
    blocked: 'bg-sx-stone-100 text-sx-muted',
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${styles[status] ?? 'bg-sx-stone-100 text-sx-muted'}`}>{label}</span>
}
