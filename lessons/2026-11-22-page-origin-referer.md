# Page-origin Referer instead of a per-site list, 2026-11-22

## What

- `getMediaReferer` no longer keeps a hand-written list of third-party video sites. A generic
  site's media now gets the origin of the page it was resolved from: `toMediaUrl` adds
  `&ref=<origin>` to `/api/video` and `/api/audio` URLs when the platform is `generic` and the
  media host has no Referer of its own, and `upstreamHeaders` sends it. `pageOriginReferer`
  reduces any value to `scheme://host[:port]/`, so a hand-built `ref` can only ever name an
  origin.
- `toRawMediaUrl` now parses the proxy URL instead of slicing after `url=`.
- `upstreamFetch.ts` (new): when an upstream answers `403` + `cf-mitigated: challenge`, the
  request is retried through `curl`, then Node `https`. Both keep the header-name case, which
  that challenge keys on. It is Node-only, never on Cloudflare, and curl is limited to
  `http,https` for the URL and its redirects.
- The Reddit FAQ copy (en + 4 locales) and its error matcher use "age-gated" wording.
- The rewritten history keeps only generic wording.

## Mistakes

- The per-site list grew one entry per reported host. Every one of them wanted the same value,
  the page's origin, which the resolver already had (`pageReferer` in the probe path) and the
  proxy did not.
- A site-specific URL rewrite was written for one host's embed links before checking whether
  the generic path covered them. It was dropped.
- Adding `&ref=` would have corrupted `toRawMediaUrl`, which decoded everything after `url=`.
  The test pins the round trip.

## What worked

- Red/green: with the `ref` fallback removed, 2 of the 6 tests in `pageReferer.test.ts` fail.

## Rules

- A Referer for an unknown CDN is the page origin, passed through the proxy URL. No host lists.
- Keep site names out of code, tests, comments, lessons and commit messages. Describe hosts by
  behaviour.
