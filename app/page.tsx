export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sx-canvas px-4">
      <div className="max-w-sm text-center">
        <p className="mb-2 text-2xl font-medium tracking-[-0.02em] text-sx-charcoal">ScheduRx</p>
        <p className="text-sm text-sx-muted">
          This page is only reachable from a booking link sent by your clinic — there&apos;s nothing to see
          here directly. If you were expecting an appointment link, please check the message your clinic
          sent you, or contact them for a new one.
        </p>
      </div>
    </div>
  )
}
