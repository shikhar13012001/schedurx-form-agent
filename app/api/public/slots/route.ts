import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots, isNettuConfigured } from '@/lib/nettu'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get('doctor_id')
  const dateFrom = searchParams.get('date_from') ?? new Date().toISOString()
  const dateTo =
    searchParams.get('date_to') ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (!doctorId) {
    return NextResponse.json({ slots: [], schedulerConfigured: false })
  }

  if (!isNettuConfigured()) {
    return NextResponse.json({ slots: [], schedulerConfigured: false })
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { nettuUserId: true, clinicId: true },
    })

    if (!doctor?.nettuUserId) {
      return NextResponse.json({ slots: [], schedulerConfigured: false })
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: doctor.clinicId },
      select: { nettuServiceId: true },
    })

    if (!clinic?.nettuServiceId) {
      return NextResponse.json({ slots: [], schedulerConfigured: false })
    }

    const slots = await getAvailableSlots(clinic.nettuServiceId, doctor.nettuUserId, dateFrom, dateTo)
    return NextResponse.json({ slots, schedulerConfigured: true })
  } catch {
    return NextResponse.json({ slots: [], schedulerConfigured: false })
  }
}
