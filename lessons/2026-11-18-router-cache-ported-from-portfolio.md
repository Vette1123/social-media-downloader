# Cloudflare speed fixes ported from the portfolio: one applied, three did not

## What
The sibling portfolio repo fixed slow taps and cold image transforms on Cloudflare. Each fix was checked against this repo before porting. Only the client router cache time applied: `experimental.staleTimes` is now `{ static: 1800, dynamic: 300 }`, pinned by `src/lib/routerCache.test.ts`.

## Mistakes
- Nearly ported the removal of the hover-only prefetch gate on reflex. Here the gate (`IntentLink`) is a measured decision, not a leftover: the homepage fell from 607 to 269 KiB by not prefetching 13 KB of RSC per link. The portfolio has no such payload budget. Left alone.
- `curl -I` against the live site returns a Cloudflare challenge (403, `cf-mitigated: challenge`), so response headers cannot be read that way. It does confirm the zone is on Cloudflare (`server: cloudflare`, `cf-ray`).

## What worked
- Grepping for the mechanism first: no `/cdn-cgi/image` use, no `purge_everything` in the deploy path (only the manual `cf-setup.mjs`), and the edge-cache rule for HTML is deliberately absent. Those fixes have nothing to fix here.
- Reading the staleTimes doc: defaults are 5 min static and 0 dynamic, so a revisit after a few minutes refetched.

## Rules
- A sibling-repo fix is ported by checking its precondition here, not by copying the diff.
- A deliberate trade-off with a lesson behind it is not undone by another repo's different trade-off.
