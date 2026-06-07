import { DM_Serif_Display, DM_Sans } from 'next/font/google'
import IntakeForm from '@/components/intake/IntakeForm'

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ clinicId: string; phone: string }>
  searchParams: Promise<{ doctor?: string }>
}) {
  const { clinicId, phone } = await params
  const { doctor } = await searchParams

  return (
    <div className={`${dmSerif.variable} ${dmSans.variable}`}>
      <IntakeForm
        clinicId={clinicId}
        phone={decodeURIComponent(phone)}
        preSelectedDoctorId={doctor}
      />
    </div>
  )
}
