# New app mark: social bubble + download arrow

## What
Replaced the play-down-over-tray mark with option E (white chat bubble holding a download arrow, teal -> cyan -> indigo tile, gloss and cast shadow), picked from a 5-option sheet rendered at 256/64/32/16 on light and dark. `src/lib/brandMark.ts` is now the one definition: favicon.svg, favicon.ico and checkout-mark.svg are written from it by `pnpm icons`, and the PWA, Apple, maskable icons, iOS launch screens, home OG image and PWA screenshot render it through Satori. ICON_VERSION 3 -> 4 so tabs and installed apps refetch. The same art went to the Telegram bot avatar and the three apps' cross-promo icons.

## Mistakes
- "One definition" was not true before: the OG image and the PWA screenshot still drew the mark before last (a stroked arrow over a bar). Two comments claimed byte-for-byte copies that a test never checked; only the manifest version had a test.
- `make-favicon.mjs` scaled `density` for a 32-unit SVG; with a 512 source that would have rendered a 1536px intermediate for 48px. Fixed to a flat 72.

## What worked
- Rendering the options as nested `<svg>` in one sheet with sharp, real 16px included, made the choice concrete; the browser-tab mock exposed B's dark tile vanishing on dark themes.
- Satori (resvg) draws a full-tile SVG data URI with gradients and feDropShadow, so the PNG icons need no div-based approximation of the art.

## Rules
- A committed file that is generated (favicon.svg, checkout-mark.svg) gets a drift test against its generator.
- New art: edit brandMark.ts, `pnpm icons`, bump ICON_VERSION and manifest `?v=` together.
