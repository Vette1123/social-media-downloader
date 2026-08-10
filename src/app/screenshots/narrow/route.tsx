import { ImageResponse } from 'next/og'
import { siteConfig } from '@/config/site'

/**
 * Portrait screenshot for the web app manifest.
 *
 * `manifest.json` already had a `wide` screenshot (it reuses the OpenGraph
 * card). Chrome only shows its richer install UI when the form factor of the
 * device matches a supplied screenshot, so with `wide` alone the desktop
 * install prompt was rich and the Android one silently fell back to the plain
 * one-line prompt. This is the missing `narrow` half.
 *
 * 720x1280 rather than a phone's true pixel count: the manifest only needs the
 * aspect ratio to be portrait, and a smaller canvas keeps the PNG that ships in
 * the static export small. Art direction deliberately matches
 * src/app/opengraph-image.tsx, since both represent the same product.
 *
 * `force-static` so this is rendered once at build time into the export and the
 * Worker never runs satori at request time.
 */
export const dynamic = 'force-static'
export const contentType = 'image/png'

const SIZE = { width: 720, height: 1280 }

const CAPABILITIES = [
  { label: 'HD video', sub: 'The full-quality source MP4' },
  { label: 'MP3 audio', sub: 'Pull the soundtrack from any link' },
  { label: 'Photo galleries', sub: 'Carousels at full resolution' },
  { label: 'Batch ZIP', sub: 'Every slideshow image in one file' },
]

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 24,
          background:
            'linear-gradient(160deg, #050506 0%, #0a0f14 50%, #050506 100%)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 36,
            padding: 48,
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 15% 10%, #22d3ee 0%, transparent 45%), radial-gradient(circle at 85% 88%, #38bdf8 0%, transparent 45%), linear-gradient(160deg, #0b0e12 0%, #0a0f14 55%, #050506 100%)',
            border: '1.5px solid rgba(56, 211, 238, 0.25)',
            boxShadow:
              'inset 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 100px 140px -60px rgba(34, 211, 238, 0.2)',
          }}
        >
          {/* Brand lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #2dd4bf 0%, #22d3ee 50%, #38bdf8 100%)',
                boxShadow:
                  '0 20px 60px rgba(34, 211, 238, 0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <svg width='40' height='40' viewBox='0 0 24 24' fill='none'>
                <path
                  d='M12 3v12m0 0l-4-4m4 4l4-4M5 21h14'
                  stroke='#ffffff'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#cffafe' }}>
                {siteConfig.shortName}
              </div>
              <div
                style={{ fontSize: 19, color: 'rgba(186, 230, 253, 0.7)' }}
              >
                {siteConfig.url.replace(/^https?:\/\/(www\.)?/, '')}
              </div>
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 72,
            }}
          >
            <div
              style={{
                fontSize: 66,
                fontWeight: 800,
                letterSpacing: -2,
                lineHeight: 1.05,
                color: '#ffffff',
              }}
            >
              Download any
            </div>
            <div
              style={{
                fontSize: 66,
                fontWeight: 800,
                letterSpacing: -2,
                lineHeight: 1.15,
                paddingBottom: 6,
                color: 'transparent',
                backgroundImage:
                  'linear-gradient(100deg, #5eead4 0%, #22d3ee 35%, #38bdf8 70%, #818cf8 100%)',
                backgroundClip: 'text',
              }}
            >
              video, free
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 25,
                lineHeight: 1.4,
                color: 'rgba(203, 240, 253, 0.72)',
              }}
            >
              TikTok, X, Instagram, Facebook, YouTube and more — public posts,
              no account.
            </div>
          </div>

          {/* Capabilities */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              marginTop: 'auto',
            }}
          >
            {CAPABILITIES.map((c) => (
              <div
                key={c.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '20px 26px',
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(56, 211, 238, 0.22)',
                  boxShadow: 'inset 0 0 0 1px rgba(34, 211, 238, 0.08)',
                }}
              >
                <div
                  style={{ fontSize: 27, fontWeight: 700, color: '#ffffff' }}
                >
                  {c.label}
                </div>
                <div
                  style={{ fontSize: 20, color: 'rgba(186, 230, 253, 0.62)' }}
                >
                  {c.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    SIZE,
  )
}
