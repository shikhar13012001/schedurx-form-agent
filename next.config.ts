import type { NextConfig } from "next";

// schedurx-backend is plain HTTP (no TLS on the droplet) while this app is
// served over HTTPS on Vercel — a client-side fetch() straight to the
// backend would be blocked as mixed content. Routing every public-API call
// through this same-origin rewrite avoids that (and CORS) entirely: the
// browser only ever talks to this app's own HTTPS origin, and Vercel's
// server proxies the request on to the backend over plain HTTP itself,
// where the browser's mixed-content policy doesn't apply.
const BACKEND_API_ORIGIN = process.env.BACKEND_API_ORIGIN ?? 'http://localhost:4000'

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/public/:path*',
        destination: `${BACKEND_API_ORIGIN}/api/v1/public/:path*`,
      },
      // Signed, single-use rebook links sent over WhatsApp/SMS (see
      // schedurx-backend's src/lib/rebook-token.js) point at this app's own
      // domain rather than the backend's, so a patient tapping the link
      // sees book.schedurx.com the whole way through instead of briefly
      // hitting api.schedurx.com before the redirect. The backend still
      // does the real HMAC verification and 302s on to the actual booking
      // page — this just keeps that hop same-origin.
      {
        source: '/r/:token',
        destination: `${BACKEND_API_ORIGIN}/r/:token`,
      },
    ]
  },
};

export default nextConfig;
