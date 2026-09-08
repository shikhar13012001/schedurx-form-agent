'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-sx-canvas">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-4xl font-medium text-sx-danger">!</p>
        <h1 className="text-xl font-medium tracking-[-0.02em] text-sx-charcoal">Something went wrong</h1>
        <p className="text-sm text-sx-muted">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-sx-stone">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="rounded-full bg-sx-charcoal px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sx-charcoal/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
