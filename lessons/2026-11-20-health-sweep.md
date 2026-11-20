# Health sweep: Snapchat profiles, gallery error bursts, blocked storage

## What

A 7-day `posthog:usage` read, with each failure traced to code:

- **Snapchat 50% failure.** 10 of 17 failed resolves were `snapchat.com/add/<user>`
  add-friend links: profiles, with no media. `linkAdvice` now names
  `/add/<user>`, `/u/<user>` and `/@user` as a Snapchat profile before any
  request. Spotlight, `/t/` and `/@user/spotlight/<id>` links still go through.
- **`download:image_item`: 23 events from 5 people** came in bursts of 5, 2 ms
  apart. One dropped connection was failing every remaining file in the loop and
  reporting each one. `isConnectionDrop` (in `imageSaves.ts`) stops the run on
  the first one; `gallerySaveOutcome` still reports how many were saved.
- **`early_crash` "Failed to read the 'localStorage' property"**: browser-blocked
  storage, thrown by PostHog's own persistence before our code runs. Added to
  `NOISE_PATTERNS`.
- `vitest.config.ts` was renamed to `.mts`: Vite warned that native config
  loading, its future default, cannot load ESM from a CommonJS package.

## Mistakes

- None of these was visible in the error board ("0 open"). They showed up only
  in `posthog:usage`'s per-extractor failure rates and in event counts compared
  with people counts. 23 events from 5 people was the clue to the burst.

## What worked

- Grouping failures by URL *shape* (`/add/*`, `/t/*`, `/p/*`) instead of by
  error string separated "wrong kind of link" from "Cobalt refused".
- Most of the 143 rage/dead clicks on `/` carry no element at all: mobile
  taps on blank space. Not acted on. The chip re-taps are 4 people or fewer.

## Rules

- A new user-facing `dn()` sentence needs all four deep locales, then
  `pnpm i18n:lock`.
- When a per-item loop reports errors, stop it on a connection-level failure:
  the remaining items cannot succeed, and each one reports again.
