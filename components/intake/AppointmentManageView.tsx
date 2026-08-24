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
    <div className="min-h-screen bg-gray-100 py-4 px-3" style={{ fontFamily: 'var(--font-dm-sans, system-ui, sans-serif)' }}>
      <div className="mx-auto max-w-[440px]">
        <div className="rounded-xl overflow-hidden shadow-sm">
          <div className="bg-[#0F6E56] px-4 py-3 text-white">
            <p className="font-semibold text-base leading-tight">{clinic.name}</p>
            {doctor && <p className="text-xs text-white/70 mt-0.5">Dr. {doctor.fullName}</p>}
          </div>

          <div className="bg-white px-4 pt-5 pb-6">
            {mode === 'view' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-xl font-bold text-[#1a1a1a]" style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}>
                    Your appointment
                  </h1>
                  <StatusBadge status={appointment.status} />
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
                  {[
                    { label: 'Doctor', value: doctor ? `Dr. ${doctor.fullName}${doctor.specialty ? ` · ${doctor.specialty}` : ''}` : '—' },
                    { label: 'Clinic', value: clinic.name },
                    { label: 'Time', value: appointment.timeslot ? formatReviewDate(appointment.timeslot) : 'To be confirmed' },
                    ...(appointment.symptoms ? [{ label: 'Symptoms', value: appointment.symptoms }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} className={`flex justify-between gap-3 px-4 py-3 ${i !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <span className="text-xs text-[#6b7280] shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-sm text-[#1a1a1a] text-right">{row.value}</span>
                    </div>
                  ))}
                </div>

                {error && <p className="text-xs text-red-500 text-center mb-3 bg-red-50 rounded-lg py-2 px-3">{error}</p>}

                {isBooked && (commsLinks?.textCommsUrl || commsLinks?.reviewUrl) && (
                  <div className="flex gap-2 mb-3">
                    {commsLinks.textCommsUrl && (
                      <a
                        href={commsLinks.textCommsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center rounded-lg border border-[#0F6E56]/20 bg-[#E1F5EE] px-3 py-2.5 text-sm font-medium text-[#0F6E56]"
                      >
                        Message us
                      </a>
                    )}
                    {commsLinks.reviewUrl && (
                      <a
                        href={commsLinks.reviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-[#1a1a1a]"
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
                      className="w-full rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 min-h-11 disabled:opacity-60"
                    >
                      Cancel appointment
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === 'reschedule' && doctorForSlotStep && (
              <div>
                {error && <p className="text-xs text-red-500 text-center mb-3 bg-red-50 rounded-lg py-2 px-3">{error}</p>}
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
                {busy && <p className="text-xs text-center text-[#6b7280] mt-3">Saving…</p>}
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
    booked: 'bg-[#E1F5EE] text-[#0F6E56]',
    cancelled: 'bg-red-50 text-red-600',
    blocked: 'bg-gray-100 text-gray-600',
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`text-[10px] font-semibold rounded-full px-2 py-1 ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>
}
