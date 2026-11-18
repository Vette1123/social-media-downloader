# 2026-11-18 - The Instagram page relay leaves Deno for its own Netlify

## What

Deno Deploy suspended the `reely` org (since 2026-11-16), so `PAGE_RELAY`
(`reely-resolver-relay.reely.deno.net/page`) answered `503 SUSPENDED`. Effect:
during an Instagram 429 cooldown the crawler-view fallback returned null; no
code or data was lost (relay source is on GitHub). `PAGE_RELAY` now points at
`reely-ig-page.netlify.app/page`, a page-only site on a separate Netlify
account (deployed from the relay repo, `npm run deploy:page`). Same Ed25519
key, no Worker secret change.

## Mistakes

- Nearly pointed `PAGE_RELAY` at the film relay's front (`relay.reely.space`):
  it works, but its Netlify team has a hard 300-credit pool and pausing it
  would take the movie player down with Instagram's 0.7 MB pages.
- This PC cannot reach `*.netlify.app` at all, so local probes time out; the
  proof came from a scratch `wrangler dev --remote` worker (unsigned 403,
  signed 200 / 673 KB / `video_versions`).

## What worked

- The relay's `/page` was host-agnostic, so the move was one constant.

## Rules

- When a free host suspends, first ask "what pointed at it" by grepping the
  hostname across repos, then check the source is in git before anything else.
