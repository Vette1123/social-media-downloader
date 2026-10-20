# 2026-10-20 — SoundCloud, Dailymotion, LinkedIn as first-class platforms

## What

Three platform ids added end to end without touching the business logic they
don't need:

- **Dailymotion** was already resolvable through Cobalt (never verified until
  now) and is labelled now. Verified live: the video in Dailymotion's own
  player docs (`x84sh87`) resolves end to end through the production API, and
  joined the platform probes.
- **LinkedIn** had no extractor (in neither cobalt list) and now has
  `tryLinkedInPost` in `downloader.ts` — the Threads pattern: ask the post URL
  as a link crawler (public posts ship `og:video:secure_url` in the anonymous
  HTML), extract via the shared `extractMediaFromHtml`. Referer branch added
  for `licdn.com`/`linkedin.com` in `proxyHeaders.ts`. Caveat: no *live* post
  URL could be verified from outside an account — LinkedIn does not index
  posts anonymous and every search engine the box reaches only serves login
  walls — so the recipe ships tested against fixtures and awaits a real-URL
  probe like every platform here needs before adding one.
- **SoundCloud** is the honest miss. Recognition (validator + narration +
  display names) was added, because the resolution question was answered
  before writing the extractor — and the answer was *no*: tested against the
  track in SoundCloud's own oEmbed docs (`forss/flickermood`, oEmbed answered
  200, the URL is alive), the production resolve 422s in both video and audio
  mode. Cobalt lists soundcloud in its service map, but what it returns is not
  served by this deployment: SoundCloud streams HLS (m3u8), which needs
  ffmpeg — a manifest-only source is rejected by design
  (`downloader.ts:1611`). A SoundCloud extractor therefore needs their public
  API with a client id, or an HLS transcode — real work, not a name.
- `PLATFORM_DISPLAY`, `resolveNarration` PLATFORMS, and `genericPlatforms` in
  `downloader.ts` all learned the three names.

Tests: 1003 green (was 991). New detectPlatform cases (incl. the deliberate
fall-throughs: a SoundCloud profile and a LinkedIn profile stay generic), and
LinkedIn extractor tests: og-video POST read as a crawler, null on a text-only
post, null on a wall (403).

## Mistakes

- The first session's own lesson ("the features I pitched were already on the
  ship") held *half* true and half catastrophic: Dailymotion was never broken,
  only unlabelled (honest diff: one regex and one name) — but my claim that
  SoundCloud already resolved through Cobalt was **never verified before
  writing code**, and the unit test that confirms it came after the push. It
  does not resolve. The lesson: membership in an upstream's service list is an
  answer only when the upstream itself is asked. The smoke list's own rule
  exists for exactly this: "every URL is verified working before it is added".
- A platform added to the display maps without a working resolver is a naming
  improvement shipped as a platform. That should be an explicit decision.
- The Edit tool swallowed the Pinterest doc header when inserting
  `tryLinkedInPost` in front of it — caught by reading back, not trusting the
  "applied". When an edit's oldString ends in someone else's comment header,
  re-include that header in the replacement.
- A 999-status stub test failed as `RangeError` — `Response` cannot express
  LinkedIn's own denial code. Same branch, honest comment as to 403.

## What worked

- The exhaustive `Record<SupportedPlatform, …>` maps meant the compiler, not
  my memory, produced the list of everything a new platform id touches
  (resolveNarration first). Two maps to cross-check by grep: `PLATFORM_DISPLAY`
  and the `genericPlatforms` route list, neither of which is exhaustive.
- Reusing `extractMediaFromHtml` (the generic page scraper) instead of a
  bespoke regmeta block — the LinkedIn path is a "which URL + how to ask"
  method on an extractor that already answers og: tags.

## Rules

- Whether a platform resolves is decided by a live URL asked of the live
  chain, never by membership in a service list or by a fixture. Verify first;
  write the code after the verdict, not around it.
- A platform whose only answer is an HLS manifest needs transcode capacity
  before it needs recognition: name it a best-effort platform or skip it until
  ffmpeg exists.
- A new platform costs either an extractor or only a name. Measure which one
  before writing the extractor — and measure with the question "what does the
  resolve answer on a definitely-alive URL".
- A bare profile URL must never claim a platform: recognition patterns match
  shareable *content* links, and the profile case stays generic.
- Every stub test must survive the exact failure codes of the real upstream —
  when ResponseInit cannot express one, take the equivalent status and say so
  in a comment.
