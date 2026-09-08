import { ImageResponse } from 'next/og'

// No per-request data here, so leave this on the default (Node) runtime —
// 'edge' would otherwise disable static generation for this fixed image.
export const alt = 'ScheduRx — Book your appointment'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Default site-wide OG card, used wherever a page doesn't override it —
// picked up automatically by Next.js for app/layout.tsx's metadata.
// Kept to system-safe fonts only: next/og's ImageResponse can't use the
// next/font-loaded faces the rest of the app uses, and fetching a Google
// Fonts file at request time is one more thing to fail silently on a shared
// link preview. Colors/marks follow the ScheduRx Master Brand Soul —
// off-white canvas, charcoal wordmark, one restrained orange accent (the
// only orange in the whole card, deliberately, per the brand's "orange
// earns attention, it isn't a flat fill" rule).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          background: '#F7F7F7',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 64,
              height: 64,
              borderRadius: 20,
              background: '#181818',
              color: '#EC6B25',
              fontSize: 34,
              fontWeight: 700,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            S
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 500, color: '#181818', letterSpacing: -0.5 }}>ScheduRx</div>
        </div>
        <div style={{ display: 'flex', marginTop: 56, fontSize: 68, fontWeight: 500, color: '#181818', letterSpacing: -1.8, lineHeight: 1.05 }}>
          Book your appointment
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: '#5C5955', maxWidth: 820 }}>
          Choose a doctor, pick a time, and confirm your visit in under a minute.
        </div>
      </div>
    ),
    { ...size },
  )
}
