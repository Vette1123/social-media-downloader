# Scheme-less redirect wrappers, 2026-11-21

## What

- posthog-watch #83: `www.google.com/url?url=…` (shape `www|/*?url`, 2 people in 3 days) still
  reached the generic extractor after #73 added `unwrapRedirect`. A link pasted from an address
  bar has no scheme, `new URL(link)` threw, and the wrapper went through untouched. Now
  `unwrapRedirect` adds `https://` to the wrapper and to the link inside it (javascript: and
  other named schemes are still refused). One fix in the shared function covers the paste box
  and `/api` resolve.
- #82 (`resolve:generic` exceptions, 4 people): all on `/telegram-downloader`, the last at 10:22Z,
  20 min before #74 reclassified Telegram's own explanations as expected. Already fixed.
- Merged dependabot #80 (7 minor/patch bumps, CI verify + build + CLS green).
- Platform monitor 13:40Z: TikTok smoke check got empty bytes from a 14 ms (cached) resolve.
  Two prod passes later were clean, and real TikTok downloads complete 97% (262/271 in 3 days).
- Search Console still 403 for the service account (known since the seo-submit lesson).

## Mistakes

- #73 was closed on a test that only pasted `https://` links, so the scheme-less version of the
  same shape kept failing and the watcher filed it again a day later.
- Ran `posthog:watch --dry-run`; the flag is `--dry`, so it was a live run and updated #82.

## What worked

- Probing `extractLink` with node's type stripping on candidate inputs found the gap in one run.
  The shape gives no values, so the probe has to try the forms a person would paste.

## Rules

- A link-shape fix gets a test without the scheme too: people paste from address bars.
- Read a script's flag parser before passing a "dry" flag.
