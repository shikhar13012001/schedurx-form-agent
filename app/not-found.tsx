import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sx-canvas">
      <div className="space-y-4 text-center">
        <p className="text-6xl font-medium tracking-[-0.03em] text-sx-charcoal">404</p>
        <h1 className="text-xl font-medium tracking-[-0.02em] text-sx-charcoal">Page not found</h1>
        <p className="text-sm text-sx-muted">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="mt-2 inline-block rounded-full bg-sx-charcoal px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sx-charcoal/90"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
