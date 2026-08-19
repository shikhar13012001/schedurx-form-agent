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
    ]
  },
};

export default nextConfig;
