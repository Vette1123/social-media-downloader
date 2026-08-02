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

/**
 * The gradient tile, at any size. One definition, so the favicon, the PWA
 * icons and the iOS launch screens cannot drift apart.
 *
 * The tile carries the colour and the glyph is the negative space, which is
 * what makes this survive at 32px on a dark taskbar. The old arrangement (ink
 * tile, thin cyan strokes) inverted both of those.
 */
function tile(size: number, radius: number, glyphRatio: number): React.ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2dd4bf 0%, #22d3ee 50%, #38bdf8 100%)',
        borderRadius: radius,
      }}
    >
      {/* satori renders this, not a browser — next/image has no meaning here. */}
      <img
        src={GLYPH_SVG}
        width={Math.round(size * glyphRatio)}
        height={Math.round(size * glyphRatio)}
        alt=''
      />
    </div>
  )
}

export function renderAppIcon(size: number, maskable = false) {
  // A maskable icon is full-bleed and square: Android crops it to whatever
  // shape the launcher uses, so the tile must not round its own corners, and
  // the glyph shrinks to stay inside the ~80% safe zone.
  return new ImageResponse(
    tile(size, maskable ? 0 : Math.round(size * 0.22), maskable ? 0.52 : 0.62),
    appIconSize(size),
  )
}

/** Must equal manifest.json's background_color and the <body> background, or
 *  the handover from launch screen to page flashes. Asserted in appIcon.test.ts. */
export const SPLASH_BACKGROUND = '#08080a'

/**
 * The iOS launch screen.
 *
 * iOS is the only platform that needs one as an image. Android composes its own
 * from the manifest's name, icon and `background_color`, which is why there is
 * no Android equivalent here — providing one would be a second source of truth
 * for the same screen.
 *
 * Deliberately just the mark on the app's own background: a launch screen is
 * shown for a few hundred milliseconds and then replaced by the page, so it
 * exists to make that handover invisible, not to say anything. Matching
 * `background_color` and the body background exactly is what makes the
 * transition read as one continuous surface instead of a flash.
 */
export function renderSplash(width: number, height: number) {
  const mark = Math.round(Math.min(width, height) * 0.26)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: SPLASH_BACKGROUND,
        }}
      >
        {tile(mark, Math.round(mark * 0.22), 0.62)}
      </div>
    ),
    { width, height },
  )
}
