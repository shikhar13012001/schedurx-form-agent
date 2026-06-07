import { PrismaClient } from '@prisma/client'
import { provisionDoctor, ensureClinicService, registerDoctorToService, setDoctorSchedule } from '../lib/nettu'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Upsert clinic
  const clinic = await prisma.clinic.upsert({
    where: { id: 'poc-clinic-001' },
    update: { name: "Dr. Sharma's Clinic", city: 'Mumbai', address: '12, Linking Road, Bandra West', phone: '9876500000' },
    create: { id: 'poc-clinic-001', name: "Dr. Sharma's Clinic", city: 'Mumbai', address: '12, Linking Road, Bandra West', phone: '9876500000' },
  })
  console.log(`Clinic: ${clinic.name} (${clinic.id})`)

  // Upsert doctors
  const doctorsData = [
    { id: 'doc-priya-001', fullName: 'Priya Sharma', specialty: 'General Physician', feeInr: 500 },
    { id: 'doc-rahul-001', fullName: 'Rahul Mehta', specialty: 'Cardiologist', feeInr: 800 },
  ]

  const doctors = []
  for (const d of doctorsData) {
    const doctor = await prisma.doctor.upsert({
      where: { id: d.id },
      update: { fullName: d.fullName, specialty: d.specialty, isActive: true },
      create: {
        id: d.id,
        clinicId: clinic.id,
        fullName: d.fullName,
        specialty: d.specialty,
        feeInr: d.feeInr,
        isActive: true,
        languages: ['en', 'hi'],
      },
    })
    doctors.push(doctor)
    console.log(`Doctor: Dr. ${doctor.fullName} (${doctor.id})`)
  }

  // Provision on nettu-scheduler if configured
  if (process.env.NETTU_SCHEDULER_URL && process.env.NETTU_ACCOUNT_API_KEY) {
    console.log('Provisioning nettu-scheduler resources...')
    try {
      const serviceId = await ensureClinicService(clinic.id, clinic.name)

      for (const doctor of doctors) {
        const { nettuUserId, nettuCalendarId } = await provisionDoctor(doctor.id, doctor.fullName)
        await registerDoctorToService(serviceId, nettuUserId)
        await setDoctorSchedule(nettuUserId, nettuCalendarId, serviceId)
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: { nettuUserId, nettuCalendarId },
        })
        console.log(`Nettu: Dr. ${doctor.fullName} → userId=${nettuUserId}`)
      }

      await prisma.clinic.update({ where: { id: clinic.id }, data: { nettuServiceId: serviceId } })
      console.log(`Nettu: clinic service → ${serviceId}`)
    } catch (err) {
      console.warn('Nettu provisioning skipped (server not reachable):', (err as Error).message)
    }
  } else {
    console.log('NETTU_SCHEDULER_URL not set — skipping nettu provisioning')
  }

  console.log('\nSeed complete.')
  console.log(`Test the form at: http://localhost:3000/poc-clinic-001/9876543210`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
