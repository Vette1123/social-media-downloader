# 2026-10-20 — SoundCloud, Dailymotion, LinkedIn as first-class platforms

## What

Three platform ids added end to end without touching the business logic they
don't need:

- **SoundCloud** and **Dailymotion** were already resolvable — plain members of
  Cobalt's service list — so the only real gap was recognition. They now detect
  as their own platform (`validator.ts`), which is what names the narration
  ("SoundCloud track"), the Recent row and the result card — before, everything
  that wasn't in the 12-id list read as "Web".
- **LinkedIn** was genuinely unsupported (in neither cobalt list), and now has
  `tryLinkedInPost` in `downloader.ts` — the Threads pattern: ask the post URL
  as a link crawler (public posts ship `og:video:secure_url` in the anonymous
  HTML), extract via the shared `extractMediaFromHtml`. Referer branch added
  for `licdn.com`/`linkedin.com` in `proxyHeaders.ts`.
- `PLATFORM_DISPLAY`, `resolveNarration` PLATFORMS, and `genericPlatforms` in
  `downloader.ts` all learned the three names.

Tests: 1003 green (was 991). New detectPlatform cases (incl. the deliberate
fall-throughs: a SoundCloud profile and a LinkedIn profile stay generic), and
LinkedIn extractor tests: og-video POST read as a crawler, null on a text-only
post, null on a wall (403).

## Mistakes

- Grep-first saved me a build: the lesson from the first session's own ledger
  ("the features I pitched were already on the ship") held again — SoundCloud
  and Dailymotion were never broken, only unlabelled. The honest diff for them
  is a regex and a name, not an extractor.
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

- A new platform costs either an extractor or only a name. Measure which one
  before writing the extractor: membership in the upstream service list is the
  answer.
- A bare profile URL must never claim a platform: recognition patterns match
  shareable *content* links, and the profile case stays generic.
- Every stub test must survive the exact failure codes of the real upstream —
  when ResponseInit cannot express one, take the equivalent status and say so
  in a comment.
