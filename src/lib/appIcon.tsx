import { ImageResponse } from 'next/og'

// PNG app-icon renderer. Chrome on Android only treats a PWA as installable —
// and only then registers its share_target in the system share sheet — when the
// manifest ships PNG icons at 192 and 512 (SVG icons don't satisfy the install
// criteria). These are generated from the same ink-tile + cyan download glyph as
// favicon.svg so the installed app matches the browser tab.
//
// `maskable` renders the glyph inside the ~80% safe zone on a full-bleed ink
// background, so Android can mask it into any shape without clipping the glyph.
export const appIconSize = (n: number) => ({ width: n, height: n })
export const appIconContentType = 'image/png'

// The cyan download-into-tray glyph on its own (transparent), as a data URI so
// Satori can rasterise it inside the icon.
const GLYPH_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 32 32" fill="none">' +
      '<defs><linearGradient id="g" x1="9" y1="8" x2="23" y2="24" gradientUnits="userSpaceOnUse">' +
      '<stop stop-color="#2dd4bf"/><stop offset="0.5" stop-color="#22d3ee"/><stop offset="1" stop-color="#38bdf8"/>' +
      '</linearGradient></defs>' +
      '<g stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 8.5V18.6"/><path d="M11 14.5 16 19.6 21 14.5"/><path d="M9.5 23.5H22.5"/>' +
      '</g></svg>',
  )

export function renderAppIcon(size: number, maskable = false) {
  const glyph = Math.round(size * (maskable ? 0.58 : 0.66))
  // Satori rejects `boxShadow: undefined`, so only include the key when used.
  const tileStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #17171d 0%, #0a0a0c 100%)',
    borderRadius: maskable ? 0 : Math.round(size * 0.22),
  }
  if (!maskable) {
    const inset = Math.max(2, Math.round(size * 0.012))
    tileStyle.boxShadow = `inset 0 0 0 ${inset}px rgba(34,211,238,0.45)`
  }
  return new ImageResponse(
    (
      <div style={tileStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={GLYPH_SVG} width={glyph} height={glyph} alt='' />
      </div>
    ),
    appIconSize(size),
  )
}
