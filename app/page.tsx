export default function RootPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-100 px-4"
      style={{ fontFamily: 'var(--font-dm-sans, system-ui, sans-serif)' }}
    >
      <div className="max-w-sm text-center">
        <p
          className="text-2xl font-bold text-[#0F6E56] mb-2"
          style={{ fontFamily: 'var(--font-dm-serif, Georgia, serif)' }}
        >
          ScheduRX
        </p>
        <p className="text-sm text-[#6b7280]">
          This page is only reachable from a booking link sent by your clinic — there&apos;s nothing to see
          here directly. If you were expecting an appointment link, please check the message your clinic
          sent you, or contact them for a new one.
        </p>
      </div>
    </div>
  )
}
