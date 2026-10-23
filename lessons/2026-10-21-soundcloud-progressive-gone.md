# The SoundCloud extractor I built for a format SoundCloud deleted

## What
Built `trySoundcloudTrack` — api-v2 `/resolve` → `media.transcodings` → a
progressive mp3 → the transcoding's own URL + `client_id` + `track_authorization`
→ the direct file — wired into `downloadGeneric`, with fixture tests and a live
probe workflow. Then verified it from datacenter egress and found SoundCloud
serves **HLS only**: no progressive transcoding, for every track and both
homepage client ids. The official SoundCloud API release notes settle it —
release `2026-08-12` removed the progressive download URL, and a maintainer
wrote "we removed progressive mp3 last week" (Aug 17, 2026). The extractor is
correct and inert: it finds no progressive and falls through to the honest 422.

## Mistakes
- Built the extractor from cobalt's source (which reads `media.transcodings`
  progressive) without first checking whether SoundCloud still *serves*
  progressive in 2026. The premise was five months stale — the recipe was right,
  the ingredient was gone.
- The probe script's first field name was wrong (`media.translations`, a field
  SoundCloud never had for this), and its asset pattern matched any
  `*.sndcdn.com` rather than the `a-v2` bundle. Both cost runs.
- The probe fetched the **track** page for the client id while the extractor
  fetches the **homepage**; the homepage's hydrate id and the bundles' id differ,
  and both answered HLS-only anyway.
- Iterated the probe ~6 times (chart endpoint 404, search fallback, `download_url`
  absent, HLS diagnostic) before one web search of the official release notes
  ended it. The search should have come first.
- The verdict landed in the lesson but not in the code: `trySoundcloudTrack`'s
  doc comment still said every step "was verified live" and answered with the
  file, and the probe workflow pasted its dispatch input straight into the
  shell. Both caught in review and fixed.

## What worked
- The probe workflow (GitHub Actions = the Worker's vantage class) is the only
  way to see this; the local box cannot reach `soundcloud.com` at all.
- Sweeping 8 real chart/search tracks × 2 client ids made the conclusion
  impossible to wave away: every combination returned only `hls`,
  `cbc-encrypted-hls`, or `ctr-encrypted-hls`.
- The codebase already documents the design — "this deployment cannot mux one
  into a file" at `downloader.ts:1811/1882/2042/2157` — so the honest 422 is the
  intended outcome, not a gap.

## Rules
- Before building an extractor for a platform, verify the platform's **current**
  streaming format from live egress. A third-party recipe is a recipe, not a
  warranty: SoundCloud deleted progressive MP3 on 2026-08-12.
- "HLS-only" is not by itself "impossible" — the playlist is unencrypted for many
  tracks (`encrypted=false`), so segments are concatenable — but this deployment
  is progressive-only by design, so the honest 422 stands until that design is
  reversed on purpose.
- A probe that mirrors the extractor step-for-step beats the extractor's own unit
  tests when the question is "does the upstream still offer this".
