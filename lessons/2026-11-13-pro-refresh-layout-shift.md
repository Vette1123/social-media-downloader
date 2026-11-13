# Pro refresh layout shift

## What
A supporter refreshing the home page saw the "Free, no account, no limits" line, the support panel and the promo box
paint and then vanish, dragging the paste bar and Download button up. The page is static, so the HTML is always the
free page, and `useTier()` only learned "pro" from `/api/auth/refresh`, a round trip after paint.
Fix: `src/lib/proFlag.ts` head script marks `<html data-pro>` before paint from the hint cookie + cached
`smd_profile.pro`; `html[data-pro] [data-free-only] { display:none !important }` keeps free-only elements unpainted;
`writeProfileCache` re-syncs the mark with every server answer; `useTier` uses the mark until the server answers, so
the batch queue no longer waits for the network either. Simulated Pro refresh at 390 px: 0 layout shifts. Free: unchanged, CLS 0.

## Mistakes
- The cached profile already held `pro` for the avatar, and `useTier` ignored it. The data to fix this existed for months.
- `HiddenForPro`'s comment chose "render for everyone, remove for supporters" to spare free visitors a hole, and
  accepted the supporter's shift as the price. A pre-paint mark avoids both.
- First cut put the `useSyncExternalStore` hook in `proFlag.ts`, which the server layout imports: dev 500'd
  ("only available in Client Components"). Script + constants stay server-safe; the hook lives in `entitlements.ts`.

## What worked
- Mirroring the existing `lowPowerScript` pattern: a head script + an attribute on `<html>` + CSS.
- `Surface` spreads props, so `data-free-only` goes on the existing root: no wrapper, no spacing change.
- Measuring with buffered `layout-shift` entries after reload; no need to hook in before load.

## Rules
- Anything that renders differently for a supporter is marked `data-free-only` (hide) or must be known at hydration
  via `useTier`. Never gate first-screen layout on a network answer.
- A module imported by `layout.tsx` must not import React hooks.
