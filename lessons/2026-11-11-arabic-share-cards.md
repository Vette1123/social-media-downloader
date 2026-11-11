# 2026-11-11 Arabic share cards, drawn by Chrome

## What

`/ar/*` pages shared the English card because satori mis-orders right-to-left
words. Now the `[lang]` image routes serve committed PNGs for `ar`
(`src/og/ar/*.png`, `lib/arOgCards.ts`). `pnpm og:ar` renders the SAME card
element the other languages send through satori (`homeOgCard`,
`platformOgCard`) to static markup, opens it in headless Chrome with
`dir="rtl"`, screenshots it, and palette-quantises it with sharp (600 KB → ~150
KB). `arOgCards.test.ts` fails when a card is missing, the wrong size, over 300
KB, or drawn from Arabic copy that has since changed.

## Mistakes

- Two satori attempts before this (Noto Sans Arabic throws on a GSUB lookup;
  Tajawal renders but reverses word order). The renderer was the problem, not
  the font.
- The first Chrome cards were 600 KB: Chrome writes lossless PNG, and link
  unfurlers drop big previews. Caught by comparing with the English card
  (174 KB) before committing.
- The Latin headline's 1.02 leading made two Arabic lines collide; only visible
  on a card that wraps. Look at the longest card, not the first one.

## What worked

- Splitting each card into an element builder and an `ImageResponse` wrapper,
  so both renderers draw one design.
- `vitest/node`'s `createViteServer` as the TSX loader: the `@` alias and JSX
  with no new dependency.
- A copy hash in a manifest, so a committed asset cannot silently go stale.

## Rules

- Changed Arabic copy? `pnpm og:ar` and commit the PNGs; the test says so.
- The generator uses Windows fonts (Segoe UI / Tahoma). On another OS set
  `CHROME` and expect a different face.
