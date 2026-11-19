# Download audit: dead TikTok tunnels, and CDN files the page can read itself

**Date:** 2026-11-19
**Scope:** `src/lib/downloader.ts` (`tryTikTokCobalt`), `src/lib/directSave.ts`,
`src/lib/apiRoutes.ts`, `src/lib/batchSave.ts`, `src/components/BatchPanel.tsx`

## What

Audited every platform from PostHog (3 days, `{humans}`) plus live replays
through production.

- **TikTok:** the daily probe was red. The server races tikwm against Cobalt,
  and Cobalt answers `status: "tunnel"` at once, so it won in ~0.2 s with a
  tunnel that answered `500` after 6.4 s on every read. `tryTikTokCobalt` now
  reads the first bytes (`probeStream`) and drops a dead tunnel, so the race
  waits for tikwm and nothing unplayable is cached.
- **Facebook, Instagram, X video:** the CDNs (`*.fbcdn.net`,
  `*.cdninstagram.com`, `video.twimg.com`) answer a cross-origin ranged GET
  with `Access-Control-Allow-Origin` and the full file, from an address other
  than the resolver's. The resolve now hands those URLs to the page as
  `directVideoUrl` with `directIsAttachment: false`; the page reads them with
  a progress bar and falls back to `/api/video` on failure. Measured: fbcdn
  3.1 vs 2.0 MB/s through the proxy, Instagram 1.9 vs 1.2, X about equal —
  and the bytes no longer cross the Worker.
- **Batch:** `saveVideoResult` navigated a hidden iframe to ANY
  `directVideoUrl`. That only saves an attachment; a raw CDN file plays
  inline and nothing is saved, while the batch logged a success.
  `batchSaveSources` navigates only to attachments and fetches the rest,
  CDN first then proxy.

## Mistakes

- **Read raw failure counts as platform health.** Twitter showed 105 resolve
  failures (24%); 75 were ONE person retrying one link, and Instagram's 20
  failed downloads were 17 from one Linux client failing at exactly 1.4 s.
  Count `uniq(person_id)` before calling anything broken.
- **`MSYS_NO_PATHCONV=1` broke `-o /dev/null`.** curl exited 23 with 0 bytes
  and it read as "the proxy returns empty bodies". Write to a real file.
- **Nearly widened `directVideoUrl` without reading its consumers.** The
  single download handled a non-attachment URL safely; batch would have
  silently saved nothing.
- A one-off 0-byte proxy read on a 34 MB file looked like a Worker limit; two
  re-runs served it in 10–13 s. This PC's network drops requests; re-run
  before diagnosing.

## What worked

- Timing the same file through `/api/video` and straight from the CDN, and
  reading the CDN's CORS headers, before deciding anything.
- `resolve_failed` carries `code` and `shape`; grouping by shape plus people
  separated a parsing bug (none) from one retrier.

## Rules

- A Cobalt tunnel is not an answer until its first bytes are read.
- `directIsAttachment` decides navigate vs fetch; never navigate to a URL
  without it.
- Add a host to `CORS_CDN_HOSTS` only after measuring its CORS headers.

## Follow-up: the MP3 button on a long YouTube video

`downloadAudio` took Cobalt's first audio tunnel unread. For `JkeyKeK3V24`
(1 h 51 min) it answered `200` with an empty body, so the MP3 button waited
~15 s and saved nothing. Innertube had already refused the same track
(`403` past the first MB without a PO token). The audio path now probes the
tunnel too; a dead one falls through to Innertube and the via-video fallback,
and when every source misses, the visitor gets "Could not extract audio" at
once. Same rule as TikTok: a tunnel is not an answer until it streams.
