# TikTok "slow": where the seconds actually went

**Date:** 2026-11-19
**Scope:** `src/lib/resolve.ts`, `src/lib/directSave.ts`, `src/components/DownloaderApp.tsx`

## What

Timed every leg of a TikTok paste on real videos (3 MB to 400 MB) from a
residential line that does 3.4 MB/s to Cloudflare:

| Leg | Measured |
|---|---|
| tikwm API from the browser | 2.2–5.6 s, 9 of 9 calls |
| Our server resolve, uncached | 0.8–3.3 s |
| tikwm CDN / Cobalt tunnel / our proxy | 1.2–2.8 MB/s each |
| 4 parallel ranged connections | no faster than 1 |

- The client gave tikwm a 700 ms head start before asking the server. tikwm
  never answers that fast any more, so every paste paid 0.7 s for nothing.
  `HEDGE_AFTER_MS` is now 0; an answer tikwm already holds still wins first.
- When the server's own tikwm call won, its `*.tiktokcdn-us.com` URL was still
  proxied through the Worker. That CDN sends `*` CORS, so it joined
  `CORS_CDN_HOSTS` and goes browser-direct.
- The direct download path now records `size_bytes`; it reported none, so
  TikTok's real throughput could not be read from PostHog.
- Since the 2026-11-18/19 tunnel fixes, the "browser" handoff (a dead tunnel
  waited out for ~6.5 s, then handed to the download manager) went from
  15/hour to 0.

## Mistakes

- First parallel-range test read the size from a HEAD, which this CDN answers
  with a 280-byte stub; "4 connections in 0.65 s" was four empty files. Read
  the size from a ranged GET's `Content-Range`.
- tikwm's `/api/user/posts` sits behind a Cloudflare challenge; only
  `/api/?url=` is usable without a browser.

## What worked

- Splitting "slow" into resolve vs transfer in PostHog first, then timing each
  leg by hand against the line's own ceiling. Transfer was already near the
  ceiling; the fixable time was the hedge.

## Rules

- Re-measure a third party's latency before keeping a delay sized for it.
- Parallel ranges buy nothing on a line the single stream already fills.

## Follow-up: the 6.5 s failures

After the hedge fix, 3 of 10 uncached server resolves still failed at exactly
6.5 s. Hitting the instances directly showed why: co.otomir23.me returns a dead
TikTok tunnel about one resolve in six (500 after 6.35 s on the first read), and
cobaltapi.cjs.nz fails TikTok 5 of 6 times. The server probed that one dead
tunnel to its end and gave up, while asking otomir23 again would have produced
a working tunnel in under a second.

`tryTikTokCobalt` now starts a second, fresh resolve as soon as the first
tunnel fails, or after `TIKTOK_TUNNEL_HEDGE_MS` (1.5 s) if it stalls; whichever
streams first wins. A link Cobalt has nothing for still costs one call. The
oembed title lookup runs alongside the probe instead of after it.

- **Mistake:** the first tunnel fix (`08ec5a5`) turned a dead tunnel into "no
  answer" and trusted the Worker's tikwm call to take over. From the Worker
  tikwm never answered, so "no answer" became "failed after 6.5 s". A fallback
  that is never seen to win is not a fallback.
- **Rule:** when a flaky upstream can be asked again, retry it beside the slow
  attempt (hedge); don't wait out the stall.
