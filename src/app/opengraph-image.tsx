import { ImageResponse } from 'next/og'
import { siteConfig } from '@/config/site'

export const runtime = 'edge'
export const alt = siteConfig.name
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 28,
          background:
            'linear-gradient(135deg, #050111 0%, #1a0633 50%, #050111 100%)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            borderRadius: 40,
            padding: 64,
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 12% 18%, #ec4899 0%, transparent 42%), radial-gradient(circle at 88% 82%, #06b6d4 0%, transparent 44%), radial-gradient(circle at 60% 50%, #8b5cf6 0%, transparent 55%), linear-gradient(135deg, #0b0218 0%, #1a0633 55%, #050111 100%)',
            border: '1.5px solid rgba(236, 72, 153, 0.25)',
            boxShadow:
              'inset 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 80px 120px -40px rgba(236, 72, 153, 0.18), inset 0 -80px 120px -40px rgba(6, 182, 212, 0.18)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(1.5px 1.5px at 18% 28%, rgba(255,255,255,0.55), transparent), radial-gradient(1.5px 1.5px at 72% 62%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 42% 82%, rgba(255,255,255,0.5), transparent), radial-gradient(2px 2px at 88% 22%, rgba(255,255,255,0.65), transparent), radial-gradient(1.5px 1.5px at 8% 70%, rgba(255,255,255,0.45), transparent)',
              display: 'flex',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 28,
                  background:
                    'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    '0 24px 70px rgba(139, 92, 246, 0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                <svg width='54' height='54' viewBox='0 0 24 24' fill='none'>
                  <path
                    d='M12 3v12m0 0l-4-4m4 4l4-4M5 21h14'
                    stroke='#ffffff'
                    strokeWidth='2.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: -0.5,
                    color: '#f5d0fe',
                  }}
                >
                  {siteConfig.shortName}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: 'rgba(186, 230, 253, 0.7)',
                  }}
                >
                  {siteConfig.url.replace(/^https?:\/\/(www\.)?/, '')}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 22px',
                borderRadius: 999,
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(74, 222, 128, 0.4)',
                color: '#86efac',
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: '#4ade80',
                  boxShadow: '0 0 16px #4ade80',
                }}
              />
              Free forever
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              marginTop: 'auto',
              zIndex: 1,
            }}
          >
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1,
                background:
                  'linear-gradient(135deg, #ffffff 0%, #f0abfc 45%, #67e8f9 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                display: 'flex',
              }}
            >
              Download TikTok &amp; X
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 600,
                color: 'rgba(243, 232, 255, 0.92)',
                letterSpacing: -0.8,
                lineHeight: 1.1,
                display: 'flex',
              }}
            >
              videos · MP3 · slideshows — no watermark
            </div>

            <div
              style={{
                display: 'flex',
                gap: 14,
                marginTop: 8,
              }}
            >
              {[
                { label: 'No login', accent: '#f0abfc' },
                { label: 'No install', accent: '#a5b4fc' },
                { label: 'HD quality', accent: '#67e8f9' },
                { label: 'No limits', accent: '#fbcfe8' },
              ].map((chip) => (
                <div
                  key={chip.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 26px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    color: chip.accent,
                    fontSize: 24,
                    fontWeight: 600,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  {chip.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
