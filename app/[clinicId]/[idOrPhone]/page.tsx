import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import IntakeForm from '@/components/intake/IntakeForm'
import AppointmentManageView from '@/components/intake/AppointmentManageView'
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

type RouteParams = { clinicId: string; idOrPhone: string }

// Per-clinic, per-appointment title/description so a link shared in WhatsApp
// (e.g. a reschedule-manage link) previews as "Appointment with Dr. X at
// Clinic Y" instead of the generic site-wide fallback in app/layout.tsx.
export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { clinicId, idOrPhone } = await params

  try {
    const { appointment, doctor, clinic } = await api.getAppointment(clinicId, idOrPhone)
    const when = appointment.timeslot
      ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(appointment.timeslot),
        )
      : null
    const title = doctor ? `Appointment with ${doctor.fullName} — ${clinic.name}` : `Your appointment — ${clinic.name}`
    const description = when ? `${when} at ${clinic.name}. Tap to view, reschedule, or cancel.` : `View, reschedule, or cancel your appointment at ${clinic.name}.`
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    }
  } catch {
    // Not an appointment id — this is the pre-booking intake entry point.
  }

  try {
    const { clinic } = await api.getClinic(clinicId)
    const title = `Book an appointment — ${clinic.name}`
    const description = `Choose a doctor, pick a time, and confirm your visit at ${clinic.name} in under a minute.`
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    }
  } catch {
    return {}
  }
}

// One route shape serves two purposes, distinguished by trying an
// appointment lookup first:
//   /{clinicId}/{appointmentId} — opened from a booking-confirmation link,
//     shows the confirmation/manage (reschedule/cancel) view.
//   /{clinicId}/{phone}         — the pre-booking entry point for a new
//     patient, falls back to the intake wizard when the id lookup 404s.
export default async function ClinicPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string; idOrPhone: string }>
  searchParams: Promise<{ doctor?: string }>
}) {
  const { clinicId, idOrPhone } = await params
  const { doctor } = await searchParams

  let appointment: api.AppointmentSummary | null = null
  try {
    appointment = await api.getAppointment(clinicId, idOrPhone)
  } catch {
    appointment = null
  }

  return (
    <div className={`${dmSerif.variable} ${dmSans.variable}`}>
      {appointment ? (
        <AppointmentManageView clinicId={clinicId} appointmentId={idOrPhone} initial={appointment} />
      ) : (
        <IntakeForm clinicId={clinicId} phone={decodeURIComponent(idOrPhone)} preSelectedDoctorId={doctor} />
      )}
    </div>
  )
}
