# SEO daily: Bing throttle is not a failure, and the November core update, 2026-11-22

## What

- SEO daily went red on both sites on 2026-11-21. Bing SubmitFeed answered
  `400 {"ErrorCode":4,"Message":"ERROR!!! ThrottleUser"}` (and ErrorCode 5 ThrottleHost on
  reely.space). One Bing key serves both sites and both crons ran at nearly the same minute.
  `submitSitemaps` now reports a throttle as `bing: 'throttled'`, logged and not warned, and
  `seo-daily` accepts it. Bing re-reads the sitemaps on its own schedule anyway.
- `bingSummary` counter jumps now also need to exceed 1% of the day's crawl (`BING_JUMP_SHARE`).
  A smaller jump prints as a line. This site crawls ~26 pages a day, so any jump still fails.
  The change is for reely.space's 48 timeouts out of 6,125 crawls.
- Search Console, 28 days to 11-21: 2,528 clicks, 21.3k impressions. The home page slid from
  position 4.3 (to 11-11) to ~6.5 (11-17 to 11-19); clicks fell from ~110 to ~70 a day. Both head
  queries slid together: "social media downloader" 2.2 → 5.0, "social media video downloader"
  3.5 → 6.5. Google's November 2026 core update started rolling out 11-10 and is expected to
  finish around 11-24. The served page is clean (200, index/follow, canonical, hreflang, 4 JSON-LD,
  H1 in HTML), so nothing was retitled. **Re-check on 2026-12-01** with the daily series (home page
  and both head queries per date) before touching titles.
- PostHog board: 0 open of 8. `seo:verify` 95/95. `cf:health`: no crawler stopped.

## Mistakes

- First edit script did string replacement on a CRLF file with LF patterns and stopped after two
  of three edits. The rerun's "already applied" guard could not see edits whose new text contains
  the old, so those two were applied twice. Caught by grep before any test ran.
- Nearly read the slide as a reaction to the 11-13 title change. The query the new title matches
  exactly slid as much as the one it dropped, which pointed away from the title.

## What worked

- Per-date GSC rows for the home page and each head query, filtered by page and by query, in one
  scratch script. The 28-day average hid when the slide started.
- Checking for a Google update before blaming our own commits.

## Rules

- A Bing SubmitFeed throttle is not a failed submit. Never let it page.
- During a core update rollout, change no titles. Wait for it to finish, then judge data from after.
