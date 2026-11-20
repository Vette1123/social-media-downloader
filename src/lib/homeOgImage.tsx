import { ImageResponse } from 'next/og'
import type { Locale } from '@/lib/i18n'
import { homeOgCopy } from '@/lib/ogCopy'
import { PLATFORM_GLYPHS } from '@/lib/ogGlyphs'
import { brandMarkDataUri } from '@/lib/brandMark'
import {
  OG_SIZE,
  OgBrand,
  OgChips,
  OgHeadline,
  OgPill,
  OgStage,
  OgTile,
  ogResponseOptions,
  siteHost,
} from '@/lib/ogKit'
import type { PlatformSlug } from '@/lib/platforms'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'

export const homeOgSize = OG_SIZE

/** The orbit around the mark, clockwise from the top: the platforms most links come from. */
const ORBIT: PlatformSlug[] = [
  'tiktok-downloader',
  'instagram-downloader',
  'youtube-downloader',
  'facebook-downloader',
  'twitter-video-downloader',
  'pinterest-downloader',
]
const ORBIT_BOX = 420
const ORBIT_RADIUS = 160
const ORBIT_TILE = 76
const MARK = 132

/** Where tile `i` of `n` sits on the orbit, as its top-left corner inside the orbit box. */
export function orbitSlot(i: number, n: number): { left: number; top: number } {
  const angle = (-90 + (360 / n) * i) * (Math.PI / 180)
  const centre = ORBIT_BOX / 2
  return {
    left: Math.round(centre + ORBIT_RADIUS * Math.cos(angle) - ORBIT_TILE / 2),
    top: Math.round(centre + ORBIT_RADIUS * Math.sin(angle) - ORBIT_TILE / 2),
  }
}

function Orbit() {
  const centre = ORBIT_BOX / 2
  return (
    <div style={{ display: 'flex', position: 'relative', width: ORBIT_BOX, height: ORBIT_BOX }}>
      {[ORBIT_RADIUS, ORBIT_RADIUS - 70].map((r) => (
        <div
          key={r}
          style={{
            position: 'absolute',
            left: centre - r,
            top: centre - r,
            width: r * 2,
            height: r * 2,
            borderRadius: 999,
            border: '1px dashed rgba(103, 232, 249, 0.22)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: centre - 120,
          top: centre - 120,
          width: 240,
          height: 240,
          borderRadius: 999,
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.35) 0%, transparent 70%)',
        }}
      />
      <img
        src={brandMarkDataUri()}
        width={MARK}
        height={MARK}
        alt=''
        style={{ position: 'absolute', left: centre - MARK / 2, top: centre - MARK / 2 }}
      />
      {ORBIT.map((slug, i) => {
        const slot = orbitSlot(i, ORBIT.length)
        return (
          <div key={slug} style={{ position: 'absolute', left: slot.left, top: slot.top, display: 'flex' }}>
            <OgTile glyph={PLATFORM_GLYPHS[slug]} size={ORBIT_TILE} />
          </div>
        )
      })}
    </div>
  )
}

/** Named platforms, then a counted rest: every platform page except the generic one is a platform. */
const ENGLISH_TAGLINE = `TikTok, Instagram, YouTube, X and ${PLATFORM_SLUGS.length - 1 - 4} more. Paste a link, keep the file.`

/** The card itself, so satori (`renderHomeOgImage`) and Chrome (`scripts/og-ar.mjs`) draw one design. */
export function homeOgCard(locale: Locale = 'en') {
  const copy = homeOgCopy(locale)
  const en = locale === 'en'
  const parts: [string, string] = en ? ['Any video, any app.', 'Original quality.'] : (copy.parts ?? [copy.headline, ''])

  return (
    <OgStage glow='45, 212, 191'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgBrand />
        <OgPill>{copy.free}</OgPill>
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: 660 }}>
          <OgHeadline parts={parts} size={en ? 64 : undefined} />
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.4, color: 'rgba(250, 250, 250, 0.62)' }}>
            {en ? ENGLISH_TAGLINE : copy.tagline}
          </div>
        </div>
        <div style={{ display: 'flex', marginRight: -30 }}>
          <Orbit />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgChips labels={copy.chips} />
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: 'rgba(250, 250, 250, 0.5)' }}>
          {siteHost}
        </div>
      </div>
    </OgStage>
  )
}

export function renderHomeOgImage(locale: Locale = 'en') {
  return new ImageResponse(homeOgCard(locale), ogResponseOptions())
}
