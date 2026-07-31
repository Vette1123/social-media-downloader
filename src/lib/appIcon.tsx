import { ImageResponse } from 'next/og'

// PNG app-icon renderer. Chrome on Android only treats a PWA as installable —
// and only then registers its share_target in the system share sheet — when the
// manifest ships PNG icons at 192 and 512 (SVG icons don't satisfy the install
// criteria). These are generated from the same gradient tile as favicon.svg so
// the installed app matches the browser tab.
//
// `maskable` renders the glyph inside the ~80% safe zone on a full-bleed tile,
// so Android can mask it into any shape without clipping the glyph.
export const appIconSize = (n: number) => ({ width: n, height: n })
export const appIconContentType = 'image/png'

/**
 * Bump when the icon art changes.
 *
 * Icons are served with `max-age=86400, stale-while-revalidate=604800`, and an
 * installed PWA holds its home-screen icon until the manifest's icon `src`
 * string itself changes. So new art at an unchanged URL reaches a returning
 * visitor a day later at best, and an installed app possibly never. Appending
 * this to every icon reference makes the URL new, which is the only thing all
 * three caches (HTTP, favicon, installed manifest) agree to respect.
 *
 * Changing it here is not enough on its own: public/manifest.json carries the
 * same `?v=` on each icon src and has to move with it. src/lib/appIcon.test.ts
 * fails when the two drift.
 */
export const ICON_VERSION = '2'

/** Appends the cache-busting version to an icon path. */
export function versionedIcon(path: string): string {
  return `${path}?v=${ICON_VERSION}`
}

// The download-into-tray glyph, knocked out in ink, as a data URI so Satori can
// rasterise it on top of the gradient. Solid masses rather than strokes: a
// stroke tuned to read at 512 disappears at 32, and this same art backs the
// favicon.
const GLYPH_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 32 32" fill="none">' +
      '<g fill="#08080a">' +
      '<rect x="14.1" y="6.6" width="3.8" height="10.4" rx="1.9"/>' +
      '<path d="M16 21.8 9.7 14.4h12.6z"/>' +
      '<rect x="8.3" y="23.2" width="15.4" height="3.2" rx="1.6"/>' +
      '</g></svg>',
  )

export function renderAppIcon(size: number, maskable = false) {
  const glyph = Math.round(size * (maskable ? 0.52 : 0.62))
  const tileStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // The tile carries the colour now and the glyph is the negative space,
    // which is what makes this survive at 32px on a dark taskbar. The old
    // arrangement (ink tile, thin cyan strokes) inverted both of those.
    background: 'linear-gradient(135deg, #2dd4bf 0%, #22d3ee 50%, #38bdf8 100%)',
    borderRadius: maskable ? 0 : Math.round(size * 0.22),
  }
  return new ImageResponse(
    (
      <div style={tileStyle}>
        {/* satori renders this, not a browser — next/image has no meaning here. */}
        <img src={GLYPH_SVG} width={glyph} height={glyph} alt='' />
      </div>
    ),
    appIconSize(size),
  )
}
