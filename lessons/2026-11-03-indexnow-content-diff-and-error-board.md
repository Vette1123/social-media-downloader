# IndexNow by content, and the error board

## What

IndexNow used git `lastmod` to pick URLs, so touching any shared source moved every
platform page in every locale. It now fingerprints each built page (title, metas,
canonical/hreflang, JSON-LD, visible text) against the page live right now and
submits only new, dropped or changed URLs. `--plan F` runs before `wrangler deploy`
(the old version still answers), `--submit F` after. Flags: `--dry-run`, `--all`,
`--force`. Ported from portfolio-v1, adapted: this site is a static export on
Cloudflare Workers deployed from GitHub Actions, not Vercel, so there is no
`postbuild` and no `VERCEL_ENV`.

Also triaged the PostHog board: the audio proxy returned 500 for every upstream
failure; audio, video and image proxies now share one retrying fetch that passes
upstream 4xx through and answers 502 otherwise. Several "issues" were
misclassified expected failures or browser noise.

## Mistakes

**The brief assumed Vercel.** The task said postbuild plus VERCEL_ENV=production. Reading
`scripts/indexnow.mjs` and the workflow first showed a snapshot/`--since` design on
Cloudflare. Porting the Vercel wiring would have shipped a guard that never fires.

**First dry-run said 80 of 80 changed on an unchanged build.** Two causes, found by
diffing fingerprints of one page: the same meta tags arrive in a different order in
live HTML (sort them), and the `?hash` on og:image/twitter:image differs between my
Windows build and the Linux one in CI (strip it). I cannot prove the hash is stable
across two Linux builds locally; if the first CI plan lists the 8 image pages as
changed, that is where to look. Cost of being wrong: 8 extra URLs per deploy.

**A `sed` for `^  )$` also edited an unrelated function** (`sitemapUrls`), and a bash
heredoc with embedded quotes silently ran nothing. The test run caught the first.

**A python-escaped regex silently did not apply** (`\b` in a non-raw string): the
replace matched nothing and reported nothing. The red test showed it.

## What worked

- Diffing fingerprints of one page instead of guessing what varies per build.
- Running the new proxy tests against the old `mediaProxy.ts`: 9 red, then green.
- Reading the error text of each issue against `failureCode` before touching code:
  most were regex gaps ("logged-in", "network error").

## Rules

- A comparison against "live" must run before the deploy, not after.
- Sort anything whose order the framework does not promise before fingerprinting.
- A proxy must say whose fault a failure is: upstream 4xx pass through, other
  upstream failures are 502, 500 is only ours.
- Read the stack before blaming code: three issues here had no frame of ours.
