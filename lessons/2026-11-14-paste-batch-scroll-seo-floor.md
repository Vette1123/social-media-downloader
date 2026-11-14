# Paste denial, batch retry, result scroll, SEO description floor

## What
- Paste chip: a clipboard denial names the gesture that works on this device
  (Ctrl+V / ⌘V with a mouse, long-press on touch); a denial Chromium remembers
  (`permissions.query('clipboard-read')` = denied) hides the chip.
- Batch "Retry failed (n)" re-runs only failures a retry can help
  (`isRetryableFailure` → `failureRetry`); unsupported links and IG stories stay put.
- The result scroll fires from an effect after the result commits, not a guessed
  500 ms timer, and jumps under reduced motion (`motionScrollBehavior`, shared
  with FeatureCardButton).
- SEO (subagent audit of all 90 built URLs): only the Arabic Terms description
  was out of range (113 chars); the info-page floor in seoLimits.test.ts went
  from 50 to 120.

## Mistakes
- None in the code paths. The SEO pass found no Search Console tooling, so it
  could not do query-level CTR work. On-page checks alone had already passed, so
  the big remaining SEO lever was data we didn't have, not markup.

## What worked
- Running the SEO audit in a subagent with a no-touch file list while the UX
  fixes landed in other files — no conflicts, one combined verify.

## Rules
- A delay that waits for React to render is a guess; scroll from an effect keyed on the state change.
- An info-page description floor of 50 hid a 113-char one; floors match the target range (120–160).

## Search Console (read in the owner's Chrome, 14 Nov; data ends 10 Nov)
- 28 days: 2.58k clicks, 22.7k impressions, 11.3% CTR, position 5.9. The home page has 2,501 of the clicks.
- Platform pages rank 15–70 (an authority gap, not a markup one). The home
  title rewrite of 10 Nov has no data yet — judge it after 24 Nov, don't churn it.
- "Crawled – currently not indexed" (19) is mostly images. Of the pages, only
  /pt/video-downloader is really out; the Reddit pages were already indexed
  (the report lags). Indexing requested for /pt/video-downloader,
  /dailymotion-downloader and /linkedin-video-downloader (LinkedIn was "unknown to Google").
- The sitemap had last been read 10 Nov with 80 URLs; resubmitted, read on 14 Nov.
- Apex socialdownloader.space 301s to www for browsers and Googlebot; bare curl
  gets the CF challenge, so test redirects with a browser UA.
- GSC deep links like /search-console/inspect?id=… 404; type the URL into the inspect box.
