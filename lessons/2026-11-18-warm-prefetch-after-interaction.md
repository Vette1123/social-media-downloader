# Warm prefetch after the first interaction

## What
Taps on the three first-viewport platform tiles are now cached before the finger lands. `IntentLink` takes a `warm` prop: after the visitor's first pointer, touch, key or scroll event, and only off Save-Data and 2G, it calls `router.prefetch` for that link in idle time (`src/lib/warmPrefetch.ts`, capped by `WARM_LIMIT = 3`). Homepage load stays 273 KiB (22 requests) with no interaction; the first interaction adds 117 KiB (3 links, about 38 KiB each). Launcher icons and the favicons get 30 days in `_headers` (were `max-age=0, must-revalidate`). `pnpm seo:verify`: 95/95.

## Mistakes
- Nearly turned viewport prefetch back on for the 6 first-screen links. Measured on the built homepage: 24 unique internal links, 6 above the fold at 390 px, and every static prefetch is about 38 KiB, not the 13 KB the 2026-10-31 lesson recorded (the page grew). Six on sight is roughly 230 KiB on a 273 KiB page, which undoes the byte-weight win.
- A regression test written through a JS template literal lost its backslashes (`/\swarm=\{/` became `/swarm={/`) and failed for the wrong reason. Patch regexes with the Edit tool.
- The first lesson file was written from a double-quoted shell string; the backticks ran as commands, the text was mangled and it was committed that way. Write lesson files with the Write tool.
- `curl --http3` prints nothing here; plain `curl -sI --compressed` with a browser UA works.

## What worked
- A CDP probe over the built export (hover each link, then scroll plus a key press) gave per-link bytes and the in-viewport set in one run.
- Live check before editing: HTTP/3 advertised (`alt-svc: h3`), zstd on HTML, `/_next/static` immutable, `/promo` and OG images 1 day plus a week stale-while-revalidate. The only real gap was `/apps/*.webp` and the favicons.
- Moving the cache rule list into `scripts/headerRules.mjs` made it testable; `cf-postbuild.mjs` runs on import and cannot be.

## Rules
- Prefetch cost is per link and grows with the page: re-measure it before trusting an old number.
- Anything that adds bytes after load waits for a real interaction, so the lab never pays for it.
- `/promo` stays at 1 day: expire-sponsors reuses file names. Only assets whose name changes with their content, or that change by a deliberate step, get 30 days.
- No remote image host is used above the fold (thumbnails appear after a resolve, through our proxy), so there is nothing to preconnect.
