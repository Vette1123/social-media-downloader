# TikTok MP3, misrouted share links, info-page JSON-LD

## What
- **TikTok MP3 failed on every post on prod.** Cobalt's TikTok *audio* tunnel
  answers `200` with 0 bytes (3 of 3 reads). The probe dropped it, correctly,
  then `fallbackAudioViaVideo` re-resolved as video with `skipCobalt: true`,
  which also disabled `tryTikTokCobalt`. That left tikwm, which never answers
  from the Worker. The fallback now skips Cobalt only when Cobalt had no answer
  at all. Live after deploy: both test posts return an `audio/mpeg` stream.
- **Share-sheet shapes landed in `generic`** and failed as "unsupported":
  letterless `facebook.com/share/<code>/` (11 resolves) and TikTok
  `/@user/photo/<id>` carousels (5). Both now reach their own extractors.
- PostHog's only open issue (stale-chunk) was already fixed by fbdad2f with no
  events since; its ledger entry pointed at the older 11-16 fix.
- SEO: `/pro`, `/privacy`, `/terms` get a WebPage + BreadcrumbList (they had
  only the site-wide nodes); `llms.txt` lists the 5 language roots.
  `seo:verify` 95/95.

## Mistakes
- `skipCobalt` meant "Cobalt missed this URL" but was set after an audio miss.
  Audio and video are different Cobalt modes; one missing says nothing about
  the other. The flag encoded a premise nobody checked per platform.
- The first regression test passed through real yt-dlp locally
  (`nativeMediaAvailable()` is true off the Worker) and fetched a live
  tiktokcdn URL. Mock `./nativeMedia` the way `downloaderPlatforms.test.ts`
  does, or the test isn't testing the Worker's path.
- Rejected from the SEO audit: per-page `#webapp` @id (one app entity is the
  right model), new landing pages for Bluesky/Loom/SoundCloud (all three fail
  on prod; a page for a broken platform is a thin page), per-platform lastmod
  (all copy lives in one file, so git can't date one platform).

## What worked
- Breaking `resolve_failed` down by `code` × `app_version` × `shape` first:
  "generic 63%" was mostly honest "unsupported", and the real bugs were the
  rows whose host was a platform we support.
- Curling the live API per format split TikTok into "video fine, audio 100%
  broken" in one minute.

## Rules
- A fallback flag that skips a source must be set only by evidence about that
  source in the same mode.
- A supported host appearing under `generic` in PostHog is a detection bug
  until proven otherwise.
