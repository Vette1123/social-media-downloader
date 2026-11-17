# Stale-chunk recovery, Next 16.4.6, SEO and PostHog check

## What
PostHog's only open issue was `Failed to load chunk /_next/static/chunks/… from
module …` (6 people, 17 Nov). Both the missing chunk and the frame that asked
for it 404 on prod: Workers static assets keep only the current build, so a tab
left open across any deploy loses its lazy chunks. `lib/staleChunk` now asks
for the failed chunk again; a 404 reloads the page once per chunk, while a
network failure leaves the page alone. Turbopack's wording joined the noise
filter. Next bumped 16.4.4 → 16.4.6 (moderate `use cache` advisory; `pnpm audit`
is clean). `seo:verify` passes 95/95 on the build and on live.

## Mistakes
- The noise filter only knew webpack's `ChunkLoadError` wording. Turbopack
  words it differently, so a known-unfixable class opened an issue anyway.
- Chased "the daily cron rebuild changes chunk hashes" for a while: chunk
  `0_7q2oe15m753.js` from the 23:13 build of 46fd577 is gone after the 13:40
  scheduled rebuild of the same commit. Two local builds were byte-identical
  and no build input is date-based, so the cause stayed unproven, and proving
  it needs a manual deploy, which is off-limits. Every push deploy breaks old
  tabs the same way, so the client-side recovery covers both.
- "112 people frustrated on /" was mostly link-input dead clicks from builds
  older than the 14 Nov filter. Check `app_version` before acting on a
  7-day frustration count.

## What worked
- Curling the stack's chunk names against prod told stale tab (404) from
  dropped connection (200) in one step.

## Rules
- A chunk-load error is triaged by asking prod for the chunk: 404 = stale tab.
- Noise patterns cover every bundler's wording; test with the captured string.
