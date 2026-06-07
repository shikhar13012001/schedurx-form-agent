import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: {
      doctors: {
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          specialty: true,
          avatarUrl: true,
        },
      },
    },
  })

  if (!clinic) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  }

  return NextResponse.json({
    clinic: {
      id: clinic.id,
      name: clinic.name,
      phone: clinic.phone,
      address: clinic.address,
      city: clinic.city,
      logoUrl: clinic.logoUrl,
    },
    doctors: clinic.doctors,
  })
}
