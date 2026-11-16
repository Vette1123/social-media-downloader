# typeof localStorage still crashes storage-blocked browsers

## What
PostHog `early_crash` "Failed to read the 'localStorage' property from 'Window': Access is denied" (6 people, Android Chrome, still firing 14 Nov after the 13 Nov fix). `proSignals.ts` guarded with `typeof localStorage === 'undefined'`; `getSnapshot` runs in render via `useSyncExternalStore`, so the throw blanked the page. `history.ts canUse()` moved to `src/lib/storageAccess.ts` as `canUseLocalStorage()`, used by both.

Also read this session: Threads `www.threads.com/share/<code>` links (14 failures / 7 days) fall through to the generic resolver as `unsupported`. Not fixed: `/share/` answers 200 with the app shell and no redirect, and a fake code can't show the mapping. Needs one real share link to build against.

## Mistakes
- The 13 Nov fix grepped for `window.localStorage` getter reads and missed `typeof localStorage`, which calls the same getter. The report's stack is where the error was *reported*, not thrown, so it pointed nowhere useful; a scan for storage reads outside a `try` found it in one pass.

## What worked
- Scan every `(local|session)Storage` reference for an enclosing `try` instead of trusting the stack.
- `properties.shape` on `resolve_failed` named the Threads share-link miss in one query.

## Rules
- `typeof localStorage` is not a guard. Use `canUseLocalStorage()`.
- Before calling an early_crash fixed, check the board a day after deploy, not only the test.
