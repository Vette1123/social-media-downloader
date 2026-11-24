# Site rules read a player API through our own relay

## What

A site that walls Cloudflare's addresses (the 369-byte stub) now resolves anyway:

- `SCRAPE_SITE_RULES` entries may carry `vid`, `hash`, `hashFormat`, `api`, `src`.
  The page's player token is re-encoded (`base36`), the player API is asked, and
  the first signed source that serves wins before the height ladder runs.
- `fetchThroughRelay` asks our signed page relay (`reely-ig-page`, Netlify) first.
  The relay (`reely-resolver-relay` 8f90abe) now fetches any signed public https
  URL instead of only Instagram posts, still refusing private/local hosts.
- `isWalled(body, contentType)` is the one wall test for both the direct read and
  the relays: a short JSON body is a payload, not a stub.

Measured from a scratch Worker (`wrangler dev --remote`) on 2026-11-24: direct
embed page and API both 369 B walls; through the relay 8592 B page + 2348 B JSON,
and the 720p MP4 it named served.

## Mistakes

- The other session's draft retried our relay three times on 403, the reader's
  policy (its cached challenge clears with `x-no-cache`). Ours means the site walls
  Netlify too, so retries only burned ~2 s and invocations. Now `once: true`.
- The JSON-is-not-a-wall check was pasted into two files; extracted to `isWalled`.
- Pushing the Worker before deploying the relay would have sent every rule site to
  an Instagram-only relay answering 403 (x3 with the retry). Relay went first.
- The test video `YI0Ch192Dyi` now answers `302 /embed404/`; that looked like a
  relay failure until the relay's `x-upstream-location` header was read.
- Probe noise: `.dev.vars` keeps JSON escapes (660 vs 580 chars, rules parsed to 0),
  so pass JSON base64; and killing `workerd` alone leaves `wrangler` respawning it.

## What worked

- Reading the relay's `x-upstream-location` before blaming the relay.
- One probe per question, a handful in total.

## Rules

- A relay we run gets one try; retries are for third-party caches.
- Deploy the relay before the Worker that depends on its wider contract.
