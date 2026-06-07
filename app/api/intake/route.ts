import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createBooking, isNettuConfigured } from '@/lib/nettu'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

function normalizePhone(phone: string): string | null {
  let p = phone.replace(/[\s\-\(\)]/g, '')
  if (p.startsWith('+91')) p = p.slice(3)
  if (p.startsWith('0')) p = p.slice(1)
  if (/^[6-9]\d{9}$/.test(p)) return p
  return null
}

export async function POST(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 })
  }

  let body: {
    clinicId?: string
    doctorId?: string
    patient?: { fullName?: string; contactNumber?: string; age?: number; gender?: string }
    appointment?: {
      bookerRelation?: string
      proxyName?: string
      symptoms?: string
      notes?: string
      timeslot?: string
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { clinicId, doctorId, patient, appointment } = body

  if (!clinicId || !doctorId || !patient?.fullName || !patient?.contactNumber || !appointment?.symptoms) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(patient.contactNumber)
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: 'Invalid mobile number. Please provide a 10-digit Indian mobile number.' },
      { status: 400 }
    )
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
  }

  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, clinicId, isActive: true },
    select: {
      fullName: true, specialty: true, isActive: true,
      nettuUserId: true, nettuCalendarId: true,
    },
  })
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found or not available at this clinic' }, { status: 400 })
  }

  const patientRecord = await prisma.patient.upsert({
    where: { clinicId_contactNumber: { clinicId, contactNumber: normalizedPhone } },
    update: {
      fullName: patient.fullName,
      ...(patient.age != null && { age: Number(patient.age) }),
      ...(patient.gender && { gender: patient.gender }),
    },
    create: {
      clinicId,
      fullName: patient.fullName,
      contactNumber: normalizedPhone,
      ...(patient.age != null && { age: Number(patient.age) }),
      ...(patient.gender && { gender: patient.gender }),
    },
  })

  const appt = await prisma.appointment.create({
    data: {
      clinicId,
      patientId: patientRecord.id,
      doctorId,
      bookerRelation: appointment.bookerRelation || 'self',
      ...(appointment.proxyName && { proxyName: appointment.proxyName }),
      symptoms: appointment.symptoms,
      ...(appointment.notes && { notes: appointment.notes }),
      ...(appointment.timeslot && { timeslot: new Date(appointment.timeslot) }),
      status: 'tentative',
    },
  })

  // Nettu booking — only if timeslot selected and nettu is configured
  if (appointment.timeslot && isNettuConfigured() && doctor.nettuUserId && doctor.nettuCalendarId && clinic.nettuServiceId) {
    try {
      const { bookingId } = await createBooking(
        clinic.nettuServiceId,
        doctor.nettuUserId,
        doctor.nettuCalendarId,
        appointment.timeslot,
        15
      )
      if (bookingId) {
        await prisma.appointment.update({ where: { id: appt.id }, data: { nettuBookingId: bookingId } })
      }
    } catch (err) {
      console.error('[intake] nettu booking failed (appointment still created):', err)
    }
  }

  // Schedule reminders if Twilio configured and timeslot exists
  if (process.env.TWILIO_ACCOUNT_SID && appointment.timeslot) {
    const timeslot = new Date(appointment.timeslot)
    const now = new Date()
    const reminders = []
    const r24 = new Date(timeslot.getTime() - 86400000)
    const r1 = new Date(timeslot.getTime() - 3600000)
    if (r24 > now) reminders.push({ appointmentId: appt.id, type: '24h', channel: 'whatsapp', scheduledAt: r24, status: 'pending' })
    if (r1 > now) reminders.push({ appointmentId: appt.id, type: '1h', channel: 'whatsapp', scheduledAt: r1, status: 'pending' })
    if (reminders.length) await prisma.reminder.createMany({ data: reminders })
  }

  return NextResponse.json({
    success: true,
    appointmentId: appt.id,
    doctor: { fullName: doctor.fullName, specialty: doctor.specialty },
    clinic: { name: clinic.name, address: clinic.address },
    timeslot: appointment.timeslot ?? null,
  })
}
