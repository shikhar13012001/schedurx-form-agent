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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-4xl font-bold text-red-500">!</p>
        <h1 className="text-xl font-semibold text-[#1a1a1a]">Something went wrong</h1>
        <p className="text-gray-500 text-sm">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2 bg-[#0F6E56] text-white rounded-lg text-sm hover:bg-[#0a5a44] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
