import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { siteConfig } from '@/config/site'
import { brandMarkDataUri } from './brandMark'
import type { PlatformGlyph } from './ogGlyphs'

/**
 * The parts every share card is built from, so the home, platform and Pro
 * cards read as one family.
 *
 * Fonts are the site's own Geist, bundled as TTF (satori reads TTF/OTF/WOFF,
 * not WOFF2). Without them satori falls back to one built-in weight, and every
 * `fontWeight: 800` headline rendered thin: the 2026-11-20 "so bad" card.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_FONT = 'Geist'

/** Brand gradient, the one in brandMark.ts: teal, cyan, indigo. */
export const BRAND_GRADIENT = 'linear-gradient(120deg, #5eead4 0%, #22d3ee 45%, #818cf8 100%)'

const FONT_WEIGHTS = [400, 600, 800] as const

/** Geist at the three weights the cards use, for `new ImageResponse(el, { fonts })`. */
export function ogFonts() {
  return FONT_WEIGHTS.map((weight) => ({
    name: OG_FONT,
    data: readFileSync(join(process.cwd(), 'src', 'og', 'fonts', `Geist-${weight}.ttf`)),
    weight,
    style: 'normal' as const,
  }))
}

/** `{ ...OG_SIZE, fonts }` for an ImageResponse. */
export function ogResponseOptions() {
  return { ...OG_SIZE, fonts: ogFonts() }
}

/**
 * A headline split into its statement and its promise: "Instagram Reels &
 * Photo Downloader — Free, No Login" → ["Instagram Reels & Photo Downloader",
 * "Free, No Login"], so the promise can carry the accent colour on its own
 * line. A headline with no dash, or a dash at either end, stays whole.
 */
export function splitHeadline(text: string): [string, string] {
  const match = text.match(/^(.+?)\s+[—–-]\s+(.+)$/)
  if (!match) return [text.trim(), '']
  return [match[1].trim(), match[2].trim()]
}

/** Headline size that keeps the longest translated statement inside three lines of the text column. */
export function ogHeadlineSize(text: string): number {
  if (text.length <= 24) return 68
  if (text.length <= 40) return 58
  return 48
}

export const siteHost = siteConfig.url.replace(/^https?:\/\/(www\.)?/, '')

/** The dark stage: two soft auroras (the accent colour top-left, brand cyan bottom-right) and a faint grid. */
export function OgStage({ glow, children }: { glow: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        // The stack only matters in Chrome (`pnpm og:ar`): Geist has no Arabic, so Arabic letters fall to Segoe UI.
        fontFamily: `${OG_FONT}, 'Segoe UI', Tahoma, sans-serif`,
        color: '#fafafa',
        background: '#07080b',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background: `radial-gradient(ellipse 620px 420px at 6% 0%, rgba(${glow}, 0.34) 0%, transparent 70%), radial-gradient(ellipse 640px 480px at 100% 100%, rgba(34, 211, 238, 0.26) 0%, transparent 70%), radial-gradient(ellipse 420px 300px at 78% 18%, rgba(129, 140, 248, 0.16) 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          opacity: 0.5,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '52px 60px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** The app mark and the name, top-left of every card. */
export function OgBrand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <img src={brandMarkDataUri()} width={52} height={52} alt='' />
      <div style={{ display: 'flex', fontSize: 25, fontWeight: 600, letterSpacing: -0.4 }}>
        {siteConfig.name}
      </div>
    </div>
  )
}

/** A quiet pill: a dot and a word ("Free forever", "Pro"). */
export function OgPill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'brand' }) {
  const green = tone === 'green'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        borderRadius: 999,
        fontSize: 20,
        fontWeight: 600,
        color: green ? '#86efac' : '#a5f3fc',
        background: green ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 211, 238, 0.12)',
        border: `1px solid ${green ? 'rgba(74, 222, 128, 0.35)' : 'rgba(103, 232, 249, 0.35)'}`,
      }}
    >
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: green ? '#4ade80' : '#22d3ee',
          boxShadow: `0 0 12px ${green ? '#4ade80' : '#22d3ee'}`,
        }}
      />
      {children}
    </div>
  )
}

/** A platform's glyph on its brand tile. */
export function OgTile({ glyph, size, tilt = 0 }: { glyph: PlatformGlyph; size: number; tilt?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size * 0.26,
        background: glyph.bg,
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: `0 ${size * 0.2}px ${size * 0.5}px rgba(${glyph.glow}, 0.45), inset 0 1px 0 rgba(255,255,255,0.3)`,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <svg width={size * 0.54} height={size * 0.54} viewBox='0 0 24 24' fill='#ffffff'>
        <path d={glyph.path} />
      </svg>
    </div>
  )
}

/** Small rounded chips along the bottom edge. */
export function OgChips({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {labels.map((label) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 19,
            fontWeight: 600,
            color: 'rgba(250, 250, 250, 0.82)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#5eead4' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M5 12.5l4.5 4.5L19 7.5' />
          </svg>
          {label}
        </div>
      ))}
    </div>
  )
}

/** The headline: the statement in white, the promise in the brand gradient on its own line. */
export function OgHeadline({ text, parts, size }: { text?: string; parts?: [string, string]; size?: number }) {
  const [statement, promise] = parts ?? splitHeadline(text ?? '')
  const fontSize = size ?? ogHeadlineSize(statement)
  const line = { display: 'flex', fontSize, fontWeight: 800, letterSpacing: -fontSize * 0.035, lineHeight: 1.04 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...line, color: '#fafafa' }}>{statement}</div>
      {promise ? (
        <div style={{ ...line, backgroundImage: BRAND_GRADIENT, backgroundClip: 'text', color: 'transparent' }}>
          {promise}
        </div>
      ) : null}
    </div>
  )
}

/**
 * What the product does, drawn: a resolved post with its quality, a download
 * button and a "Saved" toast, with the source platform's tile pinned to it.
 */
export function OgResultCard({ glyph, quality, action, saved }: { glyph: PlatformGlyph; quality: string; action: string; saved: string }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: 380, height: 380 }}>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 34,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 16,
          borderRadius: 28,
          background: 'rgba(23, 23, 29, 0.86)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 40px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            height: 176,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 18,
            backgroundImage: `linear-gradient(140deg, rgba(${glyph.glow}, 0.85) 0%, rgba(99, 102, 241, 0.7) 55%, rgba(34, 211, 238, 0.75) 100%)`,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1.5px solid rgba(255,255,255,0.5)',
            }}
          >
            <svg width='26' height='26' viewBox='0 0 24 24' fill='#ffffff'>
              <path d='M8 5.5v13l11-6.5z' />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', width: 120, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.22)' }} />
            <div style={{ display: 'flex', fontSize: 18, fontWeight: 600, color: 'rgba(250,250,250,0.6)' }}>{quality}</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 800,
              color: '#04171b',
              backgroundImage: BRAND_GRADIENT,
            }}
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#04171b' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 4v11m0 0l-5-5m5 5l5-5M5 20h14' />
            </svg>
            {action}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex' }}>
        <OgTile glyph={glyph} size={104} tilt={-9} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          borderRadius: 16,
          fontSize: 18,
          fontWeight: 600,
          background: 'rgba(12, 32, 26, 0.95)',
          border: '1px solid rgba(74, 222, 128, 0.4)',
          color: '#bbf7d0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#22c55e',
          }}
        >
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#052e16' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M5 12.5l4.5 4.5L19 7.5' />
          </svg>
        </div>
        {saved}
      </div>
    </div>
  )
}
