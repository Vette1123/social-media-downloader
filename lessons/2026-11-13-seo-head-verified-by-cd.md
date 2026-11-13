# SEO head verified by CD

## What
`scripts/seo-verify.mjs` (+ pure `scripts/lib/seo-head.mjs`, 9 tests) checks every sitemap URL twice in the deploy job:
before `wrangler deploy` against `out/` (title, description, self-canonical, no noindex, hreflang inside the sitemap,
x-default, page lists itself), and after the deploy against the live origin (200 without redirect, head identical to
the build, 4 attempts 15 s apart). `pnpm seo:verify` runs the build mode locally.

## Mistakes
- The English home title shipped wrong for weeks (bcb2060) because nothing compared what we built with what Google
  reads. Unit tests covered the metadata functions, never the exported HTML.
- First wiring put the live check before the IndexNow ping; a failing check would have skipped the ping for an
  otherwise good deploy. Moved after it.
- Local `out/` was 10 days stale; checking against it would have "passed" old pages. Rebuilt first.

## What worked
- Reusing `sitemapUrls`/`htmlRouteFor` from the IndexNow diff: the sitemap → file mapping already existed.
- A first-party User-Agent: the WAF only challenges scripted-client strings and empty UAs.
- Proving both modes fail: a planted `noindex` failed the build check; a changed built title failed the live check.

## Rules
- Any SEO change is done when `pnpm seo:verify` passes on a fresh `pnpm cf:build`, not when the unit test passes.
- Post-deploy checks that can fail go after steps that must always run (IndexNow ping).
