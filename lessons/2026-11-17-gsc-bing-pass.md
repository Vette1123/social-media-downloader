# Search Console + Bing pass: Bing serves nothing, two small fixes

## What
Read Google Search Console and Bing Webmaster Tools for both sites (17 Nov).

Social downloader, Google: 79 indexed, 36 not. Every bucket but one is intended:

| Bucket | Pages | Cause | Action |
|---|---|---|---|
| Crawled, not indexed | 19 | 16 are images, splash screens, favicons; 3 are pages: `/dailymotion-downloader`, `/id/dailymotion-downloader`, `/pt/video-downloader` | Dailymotion copy made specific (below) |
| Blocked by robots.txt | 11 | `/api/auth/google?…` sign-in links | Intended |
| Page with redirect | 3 | apex and http to `https://www` | Intended |
| Alternative canonical | 2 | `?url={search_term_string}` and `?url={url}` templates | Intended (2026-11-09 lesson) |
| noindex | 1 | `/account` | Intended |

The sitemap had last been read at 90 URLs; resubmitted, Google read all 95.

Social downloader, Bing: **1 visit from Bing in 30 days against 1,330 people
from Google.** The homepage is "Indexed successfully" yet earns no impressions;
`/es/tiktok-downloader` is still "Blocked: URL cannot appear on Bing" eight days
after Request indexing, while its Live URL test passes. That is a quality
verdict on Bing's side; no markup change clears it.

- Bing's one page-level issue was "Alt attribute for images is missing, 7
  instances": the app icons, `alt=""` on purpose because each prints its name
  beside it. `AppIcon` now gives `alt="<App> app icon"` with
  `aria-hidden="true"`, so crawlers read a name and screen readers don't hear
  it twice. Pinned in `AppIcon.test.ts`.
- The Dailymotion FAQ swapped two answers that repeated the page ("What quality
  do I get?", "Do I need an account?") for two only this page can answer:
  copying the dai.ly link in the app, and where the MP4 lands on iPhone. In all
  five languages; `platformFaq.test.ts` keeps every platform at 4-5 entries.

## Mistakes
- Added the two FAQs on top of the five and only the full suite showed the
  4-5 cap. Read the tests covering a content type before adding to it.
- My first word count of the live pages curled through Cloudflare and counted
  the "Just a moment..." page: 23 words for every route. Count from `out/`.
- Bing's 0-impressions chart looked like a reporting gap until PostHog's
  referrers confirmed it (bing.com: 1 pageview in 30 days).

## What worked
- PostHog `$referring_domain` per search engine is the ground truth for
  whether an engine sends anyone; the consoles only say what they crawled.

## Rules
- An empty alt Bing flags on a decorative icon: give it a name and hide it
  from assistive tech, rather than leaving the SEO notice standing.
- A "Blocked" Bing verdict whose Live URL test passes is not a code bug.
