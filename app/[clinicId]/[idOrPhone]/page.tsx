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
