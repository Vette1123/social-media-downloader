# Reddit blocks the Worker

## What

The daily Platform monitor has failed since 2026-10-23 (last pass 2026-10-22): "platform reddit
resolves a live public post" gets 422 every day. Production `/api/download` returns the same 422
for the monitor's post in 5.4 s.

Cause, proven from a throwaway `wrangler dev --remote` Worker on Cloudflare's edge:

| From | embed.reddit.com | www .json | api.reddit.com | www (link-preview UA) |
|---|---|---|---|---|
| Home connection | 200, `packaged-media-json` present | 403 | n/a | n/a |
| Cloudflare edge | **403** (40 bytes) | 403 | 403 | 200, og:image only, no video |

Reddit refuses Cloudflare egress on every surface that carries media. No commit near 10-22
touched the Reddit path. `embed.reddit.com` sends no CORS header, so the browser can't fetch it
for us either.

Production has no route out of Cloudflare: no `COBALT_API_URL`, no Upstash resolver discovery,
no `SCRAPE_UNLOCKER_URL` secret. The resolver in `deploy/resolver` (`/html`) is the designed
answer, but it isn't deployed, and its 256 KB HTML cap is below where Reddit's
`packaged-media-json` sits (~310 KB of 355 KB).

Not fixed in code: it needs a resolver host outside Cloudflare, which is an owner decision.

## Mistakes

- None in code. The monitor had been red for 11 days with the cause printed in its log; a
  daily failing check nobody reads is the same as no check.

## What worked

- Probing from the edge itself with `wrangler dev --remote` instead of guessing from a home IP,
  where everything worked.

## Rules

- A third-party block shows up as "works on my machine". Reproduce from the egress the
  production code actually uses.
- If the resolver is deployed for Reddit, raise `/html`'s cap past 400 KB or stream until
  `packaged-media-json` is seen.
