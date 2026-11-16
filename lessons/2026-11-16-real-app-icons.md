# Real app icons in the footer menu, hero cards and Reely link

## What
The footer "Our apps" menu, the hero's app cards and the Reely link showed one
generic phone glyph (or a film glyph) for every app. Each now shows the app's
real launcher icon from public/apps/<slug>.webp, written by `pnpm apps:icons`
from the apps' own Expo projects (Reely: its PWA icon). The trigger shows the
three icons overlapped. Also: the menu's "Our apps" eyebrow (a repeat of the
trigger) is gone, the taglines are translated in all five languages (they were
English everywhere), and Privacy/Terms/Support match the other footer links'
colour.

## Mistakes
- Reely's icon script, which this ports, guesses `<slug>/assets/images/icon.png`
  and throws for Masareef (its app lives in masareef/masareef-app). The port
  lists each source path instead.
- First RTL render: the panel opened at x = -192 on Arabic desktop.
  `sm:left-auto` cancelled the logical `sm:end-0` (both resolve to `left` in
  RTL). Explicit `sm:rtl:left-0 sm:rtl:right-auto` fixed it.
- The first two screenshot runs came back black or clipped: CDP's `clip` is in
  page coordinates (add scrollY), and scrolling before layout settles misses;
  scroll the opened menu itself into view.

## What worked
- Reusing Reely's component shape (one cached <img> component per slug) so the
  icon drops into LinkCard's existing `Icon` slot with no LinkCard change.
- A test that every listed app has its .webp on disk, seen red with the folder
  moved away.

## Rules
- Any positioned popover gets an RTL screenshot before it ships; logical and
  physical inset utilities do not mix.
