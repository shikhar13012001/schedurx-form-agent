import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-[#0F6E56]">404</p>
        <h1 className="text-xl font-semibold text-[#1a1a1a]">Page not found</h1>
        <p className="text-gray-500 text-sm">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="inline-block mt-2 px-5 py-2 bg-[#0F6E56] text-white rounded-lg text-sm hover:bg-[#0a5a44] transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
