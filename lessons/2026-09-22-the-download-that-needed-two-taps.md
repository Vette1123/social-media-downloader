# The download that needed two taps

**Date:** 2026-09-22
**Scope:** `src/lib/retry.ts`, `src/lib/downloader.ts`, `src/lib/mediaProxy.ts`, `src/components/DownloaderApp.tsx`

## What

Visitors on a phone PWA had to press the card's Video button twice: the first
tap spun for a few seconds and then showed the red "Failed to download video
file" banner, the second tap always worked. The failure was the client's
single `fetch(state.downloadUrl)` meeting a transient network drop or a
one-shot upstream 5xx, with no retry anywhere on the path — client or proxy.

`withRetry`/`isTransientError` already existed in `downloader.ts` for the
Cobalt fan-out; they moved to `src/lib/retry.ts` and now also wrap the client
video/audio downloads (2 retries) and the `/api/video` upstream fetch (1
retry). Definitive 4xx answers still fail fast on both layers.

## Mistakes

No wrong turn this time — the diagnosis had already been narrowed by earlier
probes (hydration, disabled-without-spinner, Pro token race, form-submit
swallow, cobalt cooldown, IG 429, `revokeObjectURL` all ruled out) and the
user's own report pinned the exact error string and the first-tap-after-
cold-open timing.

## What worked

- **Extracting the existing helper rather than writing a new one.** The retry
  policy (backoff, jitter, what counts as transient) was already tuned for
  this codebase's third parties; the only work was making it importable.
- **Attaching `.response.status` to the client's thrown non-2xx errors** so
  `isTransientError` can distinguish a flaky 500 (retry) from a dead 404
  (stop) — without that, every non-ok answer looked like a network-layer
  failure and would have been retried blindly.
- **Regression-testing with the existing CDP probe** (`cdp-card-test2.mjs`):
  first click must complete the download on its own, no second tap needed.

## Rules

- **A single-attempt fetch on a user-facing download button is a bug.** Any
  network hop can drop once; the button's contract is "press once, get the
  file" or "press once, get a real error that retrying won't fix".
- **When adding retry to a path that throws on `!response.ok`, attach the
  status to the error** or the classifier cannot tell 404 from 502.
- **Reuse the retry helper that already exists** (`lib/retry.ts`); a second
  hand-rolled backoff is how the policies drift.
