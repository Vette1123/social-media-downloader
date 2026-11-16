import { ImageResponse } from 'next/og'
import { brandMarkDataUri } from './brandMark'

// PNG app-icon renderer. Chrome on Android only treats a PWA as installable —
// and only then registers its share_target in the system share sheet — when the
// manifest ships PNG icons at 192 and 512 (SVG icons don't satisfy the install
// criteria). These render the same brandMark.ts art as favicon.svg so the
// installed app matches the browser tab.
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
export const ICON_VERSION = '4'

/** Appends the cache-busting version to an icon path. */
export function versionedIcon(path: string): string {
  return `${path}?v=${ICON_VERSION}`
}

/**
 * The mark at any size, from the one definition in brandMark.ts, so the
 * favicon, the PWA icons and the iOS launch screens cannot drift apart. Satori
 * rasterises the SVG data URI with resvg, gradients and shadow included.
 */
function mark(size: number, maskable = false): React.ReactElement {
  // satori renders this, not a browser — next/image has no meaning here.
  return <img src={brandMarkDataUri({ maskable })} width={size} height={size} alt='' />
}

export function renderAppIcon(size: number, maskable = false) {
  // A maskable icon is full-bleed and square: Android crops it to whatever
  // shape the launcher uses, so the art has no corners of its own and the
  // bubble sits inside the ~80% safe zone.
  return new ImageResponse(
    <div style={{ width: size, height: size, display: 'flex' }}>{mark(size, maskable)}</div>,
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
  const markSize = Math.round(Math.min(width, height) * 0.26)
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
        {mark(markSize)}
      </div>
    ),
    { width, height },
  )
}
