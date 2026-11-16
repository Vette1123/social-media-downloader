/**
 * The app mark, once. Every icon, favicon, launch screen, OG lockup and the
 * checkout image is rendered from these strings, so none of them can drift.
 *
 * The art: a white chat bubble (social) holding a download arrow (save), on the
 * brand teal -> cyan -> indigo tile, with a soft top gloss and a cast shadow
 * under the bubble. The bubble is one heavy white mass so the mark still reads
 * at 16px in a browser tab, light or dark.
 *
 * Imports nothing at runtime: scripts/make-favicon.mjs imports this .ts file
 * straight from Node to write public/favicon.svg, public/checkout-mark.svg and
 * public/favicon.ico (`pnpm icons`). brandMark.test.ts fails if those
 * committed files differ from what this module renders.
 *
 * Drawn in a 512 box. Change the art here, run `pnpm icons`, and bump
 * ICON_VERSION in appIcon.tsx (with manifest.json's `?v=`).
 */

const SIZE = 512

/** Rounded-tile corner, the same 0.22 ratio the PWA icons have always used. */
const TILE_RADIUS = 115

/** Maskable icons get cropped to any shape: the bubble shrinks into the ~80% safe zone. */
const MASKABLE_SCALE = 0.8

function defs(p: string): string {
  return (
    '<defs>' +
    `<linearGradient id="${p}t" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#2dd4bf"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient>` +
    `<linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".25"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${p}a" x1="0" y1="140" x2="0" y2="320" gradientUnits="userSpaceOnUse"><stop stop-color="#0d9488"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>` +
    `<filter id="${p}s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#312e81" flood-opacity=".4"/></filter>` +
    '</defs>'
  )
}

/** Bubble + arrow, centred in the 512 box. */
function glyph(p: string): string {
  return (
    `<path fill="#fff" filter="url(#${p}s)" d="M150 96H362Q420 96 420 154V314Q420 372 362 372H236L164 428Q146 442 146 420V372Q92 366 92 314V154Q92 96 150 96Z"/>` +
    `<g fill="url(#${p}a)">` +
    '<rect x="232" y="140" width="48" height="110" rx="24"/>' +
    '<path d="M184 218H328Q350 220 334 238L274 302Q256 320 238 302L178 238Q162 220 184 218Z"/>' +
    '</g>'
  )
}

/** The mark's inner markup in the 512 box: no outer <svg>, for nesting. */
export function brandMarkInner({ maskable = false, idPrefix = 'sd' } = {}): string {
  const radius = maskable ? 0 : TILE_RADIUS
  const tile =
    `<rect width="512" height="512" rx="${radius}" fill="url(#${idPrefix}t)"/>` +
    `<rect width="512" height="512" rx="${radius}" fill="url(#${idPrefix}g)"/>`
  const offset = (SIZE * (1 - MASKABLE_SCALE)) / 2
  const mark = maskable
    ? `<g transform="translate(${offset} ${offset}) scale(${MASKABLE_SCALE})">${glyph(idPrefix)}</g>`
    : glyph(idPrefix)
  return defs(idPrefix) + tile + mark
}

/** A standalone square SVG of the mark. */
export function brandMarkSvg({ maskable = false } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Social Downloader">${brandMarkInner({ maskable })}</svg>`
}

/** For Satori `<img src>`: it rasterises data-URI SVGs with resvg. */
export function brandMarkDataUri({ maskable = false } = {}): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg({ maskable }))}`
}

/**
 * The checkout's product image: the mark alone on a transparent 640 canvas,
 * inset 20 so no renderer clips the rounded corners at its own bounds.
 */
export function checkoutMarkSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="Social Downloader"><svg x="20" y="20" width="600" height="600" viewBox="0 0 512 512">${brandMarkInner()}</svg></svg>`
}
