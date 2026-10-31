# The crawl quota that was already full

## What

Bing Webmaster flagged "Limited crawl capacity on website" (High, 0 pages). The
advice was to raise the crawl quota and exclude useless URLs.

Checked first: Crawl Control is already at maximum for all 24 hours, the sitemap is
read with 80 URLs and 0 errors, `pnpm cf:health` shows no search crawler stopped.
Nothing in Bing needed changing.

Two things in the repo did. `robots.txt` now also disallows `/account`, its locale
copies and `/splash/`. IndexNow sends only what a deploy moved: the workflow saves
the live sitemap before deploying and `--since` diffs it against `out/sitemap.xml`.
It had been sending all 80 URLs per deploy, 1.5K in 15 hours on a busy day.

## Mistakes

**The first test import fired a real IndexNow submission.** `indexnow.mjs` ran
`main()` at import, so the red run posted the 80 URLs once more. It is guarded now.
Check what a script does at the top level before importing it from a test.

**Curl was read as bingbot for one step.** The `Just a moment...` page on
`robots.txt` was our own `curl/` rule, the exact trap in the 2026-08-15 lesson. A
browser UA and `cf:health` settled it.

**Crawl Control looked broken.** "Momentary issue" came from an unencoded `siteUrl`
in my URL; the encoded form loaded. The first read of a dashboard error should
question the link.

## What worked

- Reading every setting Bing named before editing anything. The headline advice
  (raise the quota) turned out to be a no-op.
- Using the sitemap as the state: git-based `lastmod` already says what moved, so
  the diff needs no storage.

## Rules

- The Bing flag has no page list, and no source defines it. Expect it to linger
  and judge the fix by Site Explorer's indexed count, not by this flag.
- Never send a whole URL list to IndexNow from a deploy. Send what moved.
- `/_next/` and the opengraph images stay crawlable; `src/app/robots.test.ts` pins it.
