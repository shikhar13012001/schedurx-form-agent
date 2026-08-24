// Thin client for schedurx-backend's public patient-facing booking API
// (/api/v1/public/*). This app has no backend of its own anymore — every
// clinic/slot/appointment lookup goes through the real dashboard backend, so
// a booking made here shows up on staff's calendar immediately and fires the
// exact same WhatsApp confirmation workflow every other booking path
// (voice, dashboard) already triggers.

// In the browser, calls go to this app's OWN origin at a relative path —
// next.config.ts's rewrite proxies /api/v1/public/* on to the backend
// server-side, which is what avoids both CORS and the plain-HTTP-under-HTTPS
// mixed-content block a direct browser→backend fetch would hit on Vercel.
// Server-side (a Server Component's own fetch, e.g. the appointment lookup
// in app/[clinicId]/[idOrPhone]/page.tsx) isn't a browser, so it always
// talks to the backend origin directly — a relative URL wouldn't resolve
// there anyway, since server-side fetch has no implicit base URL.
const BACKEND_ORIGIN = (process.env.BACKEND_API_ORIGIN ?? 'http://localhost:4000').replace(/\/$/, '')

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = typeof window === 'undefined' ? BACKEND_ORIGIN : ''
  const res = await fetch(`${base}/api/v1/public${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN_ERROR', body?.error?.message ?? 'Something went wrong. Please try again.')
  }
  return body.data as T
}

// ─── Types (shaped to match what IntakeForm.tsx already expects) ─────────────

export interface Clinic {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  logoUrl: string | null
}

export interface Doctor {
  id: string
  fullName: string
  specialty: string | null
  avatarUrl: string | null
}

export interface Slot {
  start: string
  end: string
}

export interface BookingInput {
  clinicId: string
  doctorId: string
  patient: { fullName: string; contactNumber: string; age?: number; gender?: string }
  appointment: {
    bookerRelation: 'self' | 'proxy'
    proxyName?: string
    symptoms: string
    notes?: string
    timeslot: string
  }
}

export interface AppointmentSummary {
  appointment: {
    id: string
    status: string
    timeslot: string | null
    symptoms: string | null
    notes: string | null
  }
  patient: { fullName: string; contactNumber: string } | null
  doctor: { id: string; fullName: string; specialty: string | null } | null
  clinic: { id: string; name: string; phone: string | null }
}

// ─── Clinic + availability ─────────────────────────────────────────────────

export async function getClinic(clinicId: string): Promise<{ clinic: Clinic; doctors: Doctor[] }> {
  const data = await request<{
    id: string
    name: string
    phone: string | null
    doctors: { id: string; fullName: string; specialty: string | null }[]
  }>(`/clinic/${encodeURIComponent(clinicId)}`)

  return {
    clinic: { id: data.id, name: data.name, phone: data.phone, address: null, city: null, logoUrl: null },
    doctors: data.doctors.map((d) => ({ id: d.id, fullName: d.fullName, specialty: d.specialty, avatarUrl: null })),
  }
}

// Matches the old /api/public/slots contract: any failure (scheduler not
// configured for this clinic/doctor yet, etc.) degrades to an empty,
// non-fatal result so the UI can fall back to "continue and the clinic will
// confirm your time" instead of showing an error.
export async function getSlots(clinicId: string, doctorId: string, date: string): Promise<{ slots: Slot[]; schedulerConfigured: boolean }> {
  try {
    const data = await request<{ slots: Slot[] }>(
      `/slots?clinicId=${encodeURIComponent(clinicId)}&doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
    )
    return { slots: data.slots, schedulerConfigured: true }
  } catch {
    return { slots: [], schedulerConfigured: false }
  }
}

// ─── Booking ────────────────────────────────────────────────────────────────

export async function bookAppointment(input: BookingInput): Promise<{ appointmentId: string; timeslot: string }> {
  const data = await request<{ appointment: { appointmentId: string; start: string } }>('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      start: input.appointment.timeslot,
      patient: {
        phone: input.patient.contactNumber,
        fullName: input.patient.fullName,
        age: input.patient.age,
        gender: input.patient.gender,
      },
      reason: input.appointment.symptoms,
      notes: input.appointment.notes,
      bookerRelation: input.appointment.bookerRelation,
      proxyName: input.appointment.proxyName,
    }),
  })
  return { appointmentId: data.appointment.appointmentId, timeslot: data.appointment.start }
}

// ─── Manage an existing booking (confirmation/reschedule/cancel page) ───────

export async function getAppointment(clinicId: string, appointmentId: string): Promise<AppointmentSummary> {
  return request<AppointmentSummary>(`/appointments/${encodeURIComponent(appointmentId)}?clinicId=${encodeURIComponent(clinicId)}`)
}

export async function rescheduleAppointment(
  clinicId: string,
  appointmentId: string,
  newStart: string,
): Promise<{ appointmentId: string; newStart: string }> {
  return request(`/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ clinicId, newStart }),
  })
}

export async function cancelAppointment(clinicId: string, appointmentId: string, reason?: string): Promise<{ appointmentId: string; status: string }> {
  return request(`/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ clinicId, reason }),
  })
}

// Thank-you page CTAs (Phase 7): a wa.me deep link straight into this
// booking's own Thread, and the clinic's Google review link — either can be
// null (no WhatsApp sender / no review link configured for this clinic yet).
export interface CommsLinks {
  reviewUrl: string | null
  textCommsUrl: string | null
}

export async function getCommsLinks(clinicId: string, appointmentId: string): Promise<CommsLinks> {
  return request<CommsLinks>(`/appointments/${encodeURIComponent(appointmentId)}/comms-links?clinicId=${encodeURIComponent(clinicId)}`)
}

// ─── Pay-first token bookings (Phase 3) ─────────────────────────────────────
// A booking a staff member made on the patient's behalf with "Lock slot with
// token" on has no Appointment row yet — just a held slot and this pending
// row — until the patient pays here. Reached via the link sent by SMS/
// WhatsApp (see schedurx-backend's api-v1-appointments.js), not the
// clinicId/idOrPhone route above, since there's no appointment to look up.
export interface PendingBooking {
  id: string
  status: 'pending' | 'completed' | 'expired' | 'cancelled'
  timeslot: string | null
  durationMinutes: number
  amountPaise: number
  expiresAt: string
  patientName: string | null
  clinic: { id: string; name: string } | null
  doctor: { id: string; fullName: string } | null
}

export async function getPendingBooking(clinicId: string, pendingBookingId: string): Promise<PendingBooking> {
  return request<{ pendingBooking: PendingBooking }>(
    `/pending-bookings/${encodeURIComponent(pendingBookingId)}?clinicId=${encodeURIComponent(clinicId)}`,
  ).then((data) => data.pendingBooking)
}

// Deliberately creates a FRESH Stripe Checkout Session on every call rather
// than reusing one from booking time (never persisted — see
// createPendingTokenBooking's own comment) — always valid regardless of how
// long ago the link was sent or how many times this page was reopened.
export async function createPendingBookingCheckoutSession(
  clinicId: string,
  pendingBookingId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ checkoutUrl: string }> {
  return request(`/pending-bookings/${encodeURIComponent(pendingBookingId)}/checkout-session`, {
    method: 'POST',
    body: JSON.stringify({ clinicId, successUrl, cancelUrl }),
  })
}
