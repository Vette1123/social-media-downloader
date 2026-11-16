# SEO and marketing sweep

## What
Ten audit defects fixed against the live site. The home HowTo now reads the
visible `home.steps`, so the markup cannot drift from the words. No copy says
"Process URL" any more (the button is "Download"). The WebApplication JSON-LD
node is per language (`copy.webApp`) and rides each landing page's own graph;
the site-wide graph keeps only WebSite, Person and Organization. The 404 emits
one robots tag (`robots: null`) and its content carries its own lang/dir.
Landing pages emit `og:image:alt` / `twitter:image:alt` in their language via
`ImageAltMeta`. The home FAQ is generic, Indonesian says Unduh/Pengunduh only,
the Organization logo is the 512px PNG, the manifest has 10 shortcuts, and the
single-item home BreadcrumbList is gone.

## Mistakes
- Ran a bare `npx prettier` in a repo with no prettier installed. It pulled
  the latest, ignored the house style (no semicolons, single quotes) and
  rewrote five files. Reverted and re-applied the edits by script.
- Reached for `homeLabel`-style global `sed` on `i18nDictionaries.ts`; the same
  key exists in all four dictionaries, so it hit es/pt/ar too. Scope a sed to
  the line range of the one locale block.
- First assumed the file-based share card could take its alt from page
  metadata. It cannot: file metadata wins, and a file exports one fixed `alt`,
  which is why every localized card had English or nothing.
- `pnpm dev` (Turbopack) cannot resolve `next` through the linked
  `node_modules` of a worktree; `next dev --webpack` can. Its `.next/dev/types`
  then breaks `tsc`, so stop it and delete `.next` before `pnpm verify`.

## What worked
- One test per defect at the closest seam (`structuredData.test.ts`,
  `seoSweep.test.ts`), seen red against origin/main's sources and green after.
- Deleting the English-only HowTo copy keys instead of editing them: a second
  copy of the steps was the bug.

## Rules
- Anything a page both shows and marks up comes from one array.
- Copy that names a control reads that control's label; test for the stale
  phrase in every locale.
- A JSON-LD node with words in it is per language, never in the root layout.
- A per-language value on a route that has a file-based card goes in a rendered
  `<meta>`, not in the card file's exports.
