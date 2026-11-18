# 2026-11-18 - TikTok "ultra slow": dead Cobalt tunnels logged as successes

## What

Reported: TikTok downloads ultra slow. Resolves were fine (p50 1.5-2.2 s).
The download events showed `delivery: browser` - the handoff to the browser's
downloader - at a flat ~6.3 s median, rising to 49% of TikTok downloads on
the day. Replaying the day's real links: `co.otomir23.me` tunnels answered
`500 Internal Server Error` after ~6.5 s on 5 of 14, or stalled mid-file
(5.7 of 10 MB in 30 s). The client handed that dead tunnel to the browser's
downloader and logged `download_completed`. The resolve cache then served the
same dead tunnel to every retry (one visitor tapped four times in 30 s).
`cobaltapi.cjs.nz` refuses TikTok outright; tikwm served all four failing
videos in full.

Fix: a TikTok tunnel that fails or stalls is retried from tikwm in the
browser (`wantsTikwmFallback`, `src/lib/tunnelFallback.ts`), and the handoff
and proxy retry use tikwm's URLs, never the dead tunnel. New delivery value
`tikwm_fallback` counts how often it fires.

## Mistakes

- First test used a 3 MB clip that every path served at 1.5 MB/s and
  nearly concluded "can't reproduce". The real signal was in PostHog: a
  constant 6.3 s duration is a timer, not a transfer.
- Timed `/api/download` in the page and called it the user's path - the card
  had actually come from the client tikwm resolve. Check which resolver won
  before timing its URL.
- `download_completed` with `delivery: browser` was counting failures as
  successes for weeks; the success metric hid the outage.

## What worked

- `content_url` on the events: replaying the exact links users pasted found
  the failure in one pass.
- `duration_s` missing = Cobalt (it reports 0), present = tikwm: the
  delivery split fell out of a property nobody meant as a source tag.

## Rules

- A handoff whose outcome we cannot see is not a completion; never let a
  fallback inherit the URL that just failed.
- Not done: the resolve cache still keeps a dead tunnel for its TTL, and the
  batch panel's hidden-iframe tunnel save cannot see failures at all.
