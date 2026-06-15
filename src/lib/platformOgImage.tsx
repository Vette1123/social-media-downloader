import { ImageResponse } from 'next/og'
import { siteConfig } from '@/config/site'
import type { PlatformSlug } from '@/lib/platforms'
import { platformsBySlug } from '@/lib/platforms'

export const ogImageSize = { width: 1200, height: 630 }
export const ogImageContentType = 'image/png'

interface PlatformGlyph {
  bg: string
  glow: string
  path: string
}

const PLATFORM_GLYPHS: Record<PlatformSlug, PlatformGlyph> = {
  'tiktok-downloader': {
    bg: '#010101',
    glow: '236, 72, 153',
    path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V7.93a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.36z',
  },
  'twitter-video-downloader': {
    bg: '#000000',
    glow: '56, 189, 248',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  'instagram-downloader': {
    bg: 'linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 52%, #962FBF 76%, #4F5BD5 100%)',
    glow: '214, 41, 118',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  'facebook-downloader': {
    bg: '#1877F2',
    glow: '24, 119, 242',
    path: 'M16.4 12.06h-2.62V20h-3.1v-7.94H8.86V9.4h1.82V7.85c0-2.15 1.28-3.35 3.24-3.35.94 0 1.93.17 1.93.17v2.12h-1.08c-1.06 0-1.4.66-1.4 1.34V9.4h2.37l-.38 2.66z',
  },
  'youtube-downloader': {
    bg: '#FF0000',
    glow: '255, 0, 0',
    path: 'M9.8 8.2 16 12l-6.2 3.8z',
  },
}

export function renderPlatformOgImage(slug: PlatformSlug) {
  const platform = platformsBySlug[slug]
  const glyph = PLATFORM_GLYPHS[slug]

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
            padding: 56,
            overflow: 'hidden',
            background: `radial-gradient(circle at 18% 22%, rgba(${glyph.glow}, 0.55) 0%, transparent 48%), radial-gradient(circle at 84% 78%, #06b6d4 0%, transparent 44%), radial-gradient(circle at 60% 50%, #8b5cf6 0%, transparent 55%), linear-gradient(135deg, #0b0218 0%, #1a0633 55%, #050111 100%)`,
            border: `1.5px solid rgba(${glyph.glow}, 0.35)`,
            boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 80px 120px -40px rgba(${glyph.glow}, 0.22), inset 0 -80px 120px -40px rgba(6, 182, 212, 0.18)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background:
                'radial-gradient(1.5px 1.5px at 18% 28%, rgba(255,255,255,0.55), transparent), radial-gradient(1.5px 1.5px at 72% 62%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 42% 82%, rgba(255,255,255,0.5), transparent), radial-gradient(2px 2px at 88% 22%, rgba(255,255,255,0.65), transparent), radial-gradient(1.5px 1.5px at 8% 70%, rgba(255,255,255,0.45), transparent)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 24,
                  background: glyph.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 20px 60px rgba(${glyph.glow}, 0.55), inset 0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                <svg width='52' height='52' viewBox='0 0 24 24' fill='#ffffff'>
                  <path d={glyph.path} />
                </svg>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'rgba(186, 230, 253, 0.65)',
                    display: 'flex',
                  }}
                >
                  {`${platform.name} downloader`}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    color: 'rgba(186, 230, 253, 0.55)',
                    display: 'flex',
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
              gap: 22,
              marginTop: 'auto',
              zIndex: 1,
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: -2.5,
                lineHeight: 1.02,
                background:
                  'linear-gradient(135deg, #ffffff 0%, #f0abfc 45%, #67e8f9 100%)',
                backgroundClip: 'text',
                color: 'transparent',
                display: 'flex',
              }}
            >
              {platform.h1}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: 'rgba(243, 232, 255, 0.92)',
                letterSpacing: -0.6,
                display: 'flex',
              }}
            >
              {platform.tagline}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                marginTop: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 14 }}>
                {[
                  { label: 'No login', accent: '#f0abfc' },
                  { label: 'No watermark', accent: '#a5b4fc' },
                  { label: 'HD', accent: '#67e8f9' },
                  { label: 'No limits', accent: '#fbcfe8' },
                ].map((chip) => (
                  <div
                    key={chip.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '13px 24px',
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: `1px solid rgba(${glyph.glow}, 0.35)`,
                      color: chip.accent,
                      fontSize: 23,
                      fontWeight: 600,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    {chip.label}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  whiteSpace: 'nowrap',
                  fontSize: 25,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    color: 'rgba(186, 230, 253, 0.55)',
                    fontWeight: 500,
                  }}
                >
                  by
                </span>
                <span style={{ display: 'flex', color: '#f0abfc' }}>
                  mohamedgado.com
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    ogImageSize,
  )
}
