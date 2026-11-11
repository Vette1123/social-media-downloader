# Locale share cards

## What
es, pt and id pages now get Open Graph and Twitter cards drawn in their own language
(`src/app/[lang]/opengraph-image.tsx`, `[lang]/[slug]/opengraph-image.tsx`, plus twitter
twins). The words come from one pure module, `src/lib/ogCopy.ts`, pinned by `ogCopy.test.ts`.
Arabic stays on the English card.

## Mistakes
- Tried Noto Sans Arabic first: satori's font parser throws `lookupType: 5 - substFormat: 3
  is not yet supported` on its GSUB table. Tajawal parses, but satori then orders the words
  of an RTL line wrongly (gaps, "TikTok" and "MP3" in the wrong place), with or without
  `direction: rtl`. Joined letters alone are not a correct Arabic card.
- `fontFamily: undefined` in a satori style crashes (`reading 'split'`); spread the key in
  only when you have a font.
- The localized metadata passed explicit English image URLs, which would have beaten the
  new file-convention images. They had to go.
- `pnpm dev` (Turbopack) cannot start in a worktree whose `node_modules` is a link; use
  `npx next dev --webpack`.

## What worked
- Looking at the rendered PNG, not trusting that the glyphs drew. Dev server + curl of the
  image route is enough; no `pnpm build`.
- Keeping the language choice in a pure function (`ogCardLocale`) so "Arabic falls back" is
  tested, not just a comment.

## Rules
- A share card in a script satori cannot lay out stays on the English card until a rendered
  PNG reads correctly.
- Never set an explicit `images` in page metadata where a `[lang]` image file exists.
