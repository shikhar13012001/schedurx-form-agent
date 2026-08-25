import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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

// A real appointment id (apt_<uuid>) that no longer resolves — deleted,
// wrong clinic, a stale/garbled link — used to fall through to the intake
// wizard (same "not an appointment id, must be the pre-booking entry point"
// reasoning IntakeForm itself is built on), but IntakeForm's Mobile field is
// a locked display of whatever this route hands it as `phone` — never an
// editable input (see its own "Wrong number? Ask the clinic to resend your
// booking link" hint) — so a non-phone value there produced a booking form
// nobody could ever submit: "apt_2201f6d0-c6d5-... must be a valid 10-digit
// Indian mobile number", with no way to fix it. Only enter the intake
// wizard when this segment is actually phone-shaped; anything else was
// meant as an appointment id that just doesn't resolve, so a real
// not-found page is the honest answer, not a broken form.
function looksLikePhone(value: string): boolean {
  return /^\+?[\d\s-]{7,15}$/.test(value)
}

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
  } catch (err) {
    // A real 404 means this segment isn't an appointment id — fall through
    // to the phone-shaped-id check below. Anything else (backend down,
    // network blip) isn't "not found" — let it bubble to error.tsx instead
    // of silently treating a transient outage as a dead link.
    if (err instanceof api.ApiError && err.status === 404) {
      appointment = null
    } else {
      throw err
    }
  }

  const decoded = decodeURIComponent(idOrPhone)
  if (!appointment && !looksLikePhone(decoded)) notFound()

  return (
    <div className={`${dmSerif.variable} ${dmSans.variable}`}>
      {appointment ? (
        <AppointmentManageView clinicId={clinicId} appointmentId={idOrPhone} initial={appointment} />
      ) : (
        <IntakeForm clinicId={clinicId} phone={decoded} preSelectedDoctorId={doctor} />
      )}
    </div>
  )
}
