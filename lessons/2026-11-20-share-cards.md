# Share cards rebuilt (2026-11-20)

## What
The Instagram share card looked cheap. Rebuilt the home, platform and Pro OG cards on one kit (`src/lib/ogKit.tsx`): Geist fonts bundled for satori, an aurora stage, a drawn "resolved post" card with a Download button and a Saved toast, a platform orbit on home, and a Pro plan card where the price is the biggest thing. Arabic cards (`pnpm og:ar`, Chrome) now load the same Geist. Deleted the unused `public/pro-card.png`, which still showed the old mark and the old $3/$24 prices. `pnpm og:preview [slug] [locale]` renders any card to PNG without `next dev`.

## Mistakes
- Root cause was never the layout: satori had no font, so every `fontWeight: 800` headline rendered in one thin fallback face. Every earlier "polish" pass styled around a missing font.
- `transform: undefined` crashes satori ("Invalid transform value"); pass `rotate(0deg)` instead of omitting it.
- The home tagline was the bare "Any public link": a card line copied from a UI label says nothing out of context.
- A stale marketing PNG with old prices sat in `public/` unused but publicly served. Nothing referenced it, so nothing caught it.

## What worked
- Rendering every card to PNG with vite `ssrLoadModule` and looking at all 17 before committing. `next dev` does not start in a linked worktree.

## Rules
- Any satori card passes `ogResponseOptions()` (fonts included); a test asserts Geist 400/600/800 load.
- Prices on cards come from `SUPPORT_PRICES`, perks from `PRO_BENEFITS` by title (throws when a perk is renamed).
- Look at the rendered PNG, at full size, in at least en + one long locale before shipping a card.
