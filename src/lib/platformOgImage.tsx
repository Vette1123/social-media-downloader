import { ImageResponse } from 'next/og'
import type { Locale } from '@/lib/i18n'
import { platformOgCopy } from '@/lib/ogCopy'
import { PLATFORM_GLYPHS } from '@/lib/ogGlyphs'
import {
  OG_SIZE,
  OgBrand,
  OgChips,
  OgHeadline,
  OgPill,
  OgResultCard,
  OgStage,
  ogResponseOptions,
  siteHost,
} from '@/lib/ogKit'
import type { PlatformSlug } from '@/lib/platforms'

export const ogImageSize = OG_SIZE
export const ogImageContentType = 'image/png'

/** The card itself, so satori (`renderPlatformOgImage`) and Chrome (`scripts/og-ar.mjs`) draw one design. */
export function platformOgCard(slug: PlatformSlug, locale: Locale = 'en') {
  const copy = platformOgCopy(locale, slug)
  const glyph = PLATFORM_GLYPHS[slug]

  return (
    <OgStage glow={glyph.glow}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgBrand />
        <OgPill>{copy.free}</OgPill>
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 650 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
              color: '#67e8f9',
            }}
          >
            {copy.label}
          </div>
          <OgHeadline text={copy.headline} />
          <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.4, color: 'rgba(250, 250, 250, 0.62)' }}>
            {copy.tagline}
          </div>
        </div>
        <OgResultCard glyph={glyph} quality='MP4 · HD' action={copy.action} saved={copy.saved} />
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

export function renderPlatformOgImage(slug: PlatformSlug, locale: Locale = 'en') {
  return new ImageResponse(platformOgCard(slug, locale), ogResponseOptions())
}
