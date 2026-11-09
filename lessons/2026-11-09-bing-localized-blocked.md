# Bing indexed 14 of 80 URLs: the localized pages were "Blocked", not queued

## What

Bing Site Explorer showed 14 indexed URLs, all root-level English pages. All 64
`/es` `/pt` `/id` `/ar` pages were missing, along with `/privacy` and `/terms`.

- The edge does not stop Bingbot. A Bingbot-UA fetch gets the full 154 KB page
  from cache, and `cf-setup.mjs health` shows no crawler stopped in 24h.
- The markup is correct: self-canonical, a full hreflang set with x-default,
  `index, follow`, translated body text. Every English page links its four
  translations with plain `<a href>`.
- IndexNow sent all 80 URLs on the 65485f3 deploy and got `200 OK`.
- Bing URL Inspection had the cause. The index status of `/es/tiktok-downloader`
  was **Blocked: "URL cannot appear on Bing"**. The Live URL test of the same
  page said "URL can be indexed by Bing", with no SEO issues and both markup
  types found. So the verdict was stale and came from an earlier crawl, not
  from the page as it is today. The English twin was indexed successfully.
- Fix on Bing's side: Request indexing on that page, then a bulk URL Submission
  of the other 65 (66 of the 100-a-day quota). That makes Bing re-evaluate the
  live pages instead of keeping the old verdict.
- Fix in the repo: the weekly `Cloudflare edge policy` run had been failing
  since 2026-11-02 on 13 "crawler" groups. Each one was a single IP with a
  crawler user agent asking for `/core/.env`, `/env.bak` and similar paths. The
  probe rule blocking them was correct, but the health check matched on the user
  agent alone. `scripts/lib/edge-health.mjs` now owns `PROBE_EXTENSIONS` and
  `HEALTH_MUST_PASS`, and `isMustPassStop` ignores a stop on a probe path. The
  rule and the check read one list.

## Mistakes

- I first called this a backlog that only time clears. Neither a clean sitemap
  report nor a 200 from IndexNow says whether Bing will serve a page. Only URL
  Inspection's Bing Index tab does, and I hadn't opened it.
- My first link check used curl's default user agent. The WAF challenges that,
  so I grepped a challenge page and found "no links".
- `git ls-files | xargs grep -l $'\r'` printed nothing, and I read that as a
  clean checkout. The suite still failed on CRLF.
- The edge-policy run had been red for a week without anyone noticing. A check
  that fails on scanners every week stops being read, and the one real Bingbot
  block would have been lost in that noise.

## What worked

- Comparing Bing Index with Live URL for the same URL. A stale verdict and a
  live defect look identical in Site Explorer and opposite in that pair.
- Moving the classifier into `scripts/lib`, because `cf-setup.mjs` runs `main()`
  on import. The new test imports the lib, sees red without the guard (6 of 9
  fail) and green with it.

## Rules

- When Bing is missing pages, inspect one in URL Inspection first. "Blocked"
  with a passing Live URL test means: Request indexing and bulk-submit (100 a
  day). It does not mean wait.
- Fetch our own pages with a browser user agent. Default curl gets the WAF
  challenge.
- A crawler user agent on a path nothing serves is a scanner. Classify by path
  before user agent.
