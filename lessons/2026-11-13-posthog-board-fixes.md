# PostHog board fixes

## What
- Two open issues on the error board, both from real visitors:
  - `localStorage` denied (storage blocked by the browser): `history.ts canUse()` and the `<head>` pro-flag script both read the `localStorage` getter outside a try. Both now catch it.
  - `[object Object]` rejections: `errorMessage` now reports the constructor and the key names (never values), so the next one is diagnosable.
- Two dashboard tiles read all-null:
  - `pro` / `signed_in` were missing on 92% of events. The account store only calls `/api/auth/refresh` when the session hint cookie is set, so for anonymous visitors `signedIn` stays `undefined` forever, and `AnalyticsContext` waited on it before registering signed-out. `accountContextFor(signedIn, hasHint)` treats "no hint" as signed out right away.
  - `status` on `api_error` is null for early crashes: they have no HTTP status. The tile now shows `none`.

## Mistakes
- Overwrote `analyticsErrors.test.ts` with a fresh file instead of appending; restored from `git show HEAD:` before anything was lost.
- First instinct on the `pro` column was "the register runs after events". It was never running at all for anonymous visitors. Querying the property split (`toString(properties.pro)` grouped) showed the 26k-event null bucket in one call; that should have been the first step.

## What worked
- `pnpm posthog:setup --check` flagged both tiles; one grouped HogQL query per tile separated a real bug (`pro`) from a data fact (`status`).
- Testing the shipped head-script text (`new Function('window', proFlagScript)`) caught the argument-evaluated-outside-try bug the function-only test missed.

## Rules
- A super property gated on an async account answer needs a "never asked" path; anything gated on a cookie hint can stay undefined forever.
- Before blaming the client for a null column, group the property by value: a null that is real (no HTTP status on a crash) belongs in the tile as a label, not a fix in the client.
