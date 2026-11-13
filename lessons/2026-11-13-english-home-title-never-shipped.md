# The English home title change never shipped

## What

Search Console + Bing pass, 2026-11-13 (GSC data to 11-10, 28 days): 2.58k clicks, 22.7k impressions,
11.3% CTR, position 5.9. The home page has 2,501 of the clicks and 21.5k of the impressions.

- **The 11-10 title change never reached the English home page.** It edited `pageCopy.home.metaTitle`, but
  `/` takes its `<title>`, description, OG and Twitter tags from `src/app/layout.tsx`, which had its own
  literal (`Social Media Downloader — Save Any Public Video in HD`) and `siteConfig.description`. The four
  translated homes read `pageCopy.home`, so only they changed. The English JSON-LD WebPage had the same split.
  Both now read `pageCopy.home`; `structuredData.test.ts` pins it (red on the old files, green now).
- **Vimeo title** now matches the searches: "vimeo to mp4" (114 impressions, position 13.8) and its variants.
  `Vimeo to MP4 Downloader — Save HD Vimeo Videos, No Login`.
- **Index report, nothing to fix:** robots-blocked 11 (`/api/auth/google`, nofollowed 11-09), redirect 3,
  alternative canonical 2 (the `{search_term_string}` templates removed 11-09, waiting on a recrawl),
  noindex 1 (`/account`, intended), crawled-not-indexed 19 (16 are images/splash/favicon; real pages:
  `/reddit-video-downloader`, `/pt/video-downloader`, `/id/reddit-video-downloader`).
- **Apex** `socialdownloader.space` 301s to www for browser and Googlebot agents (curl's default agent gets
  the WAF's 403; that is not what crawlers see).
- **Bing:** 0 clicks and 0 impressions in 3 months, 14 URLs indexed, no recommendations.
  `/es/tiktok-downloader` is still "Blocked: URL cannot appear on Bing" four days after the 11-09
  re-request. The Live URL test passes, so this is Bing's judgement of the site, not a page defect.

## Mistakes

- The 11-10 lesson said "Home title now names the biggest-impression query". It checked the source string,
  not the served page. One `curl -A <browser UA> | grep '<title>'` would have shown the old title.
- My first apex check used curl's default agent and got 403; same trap as the 08-15 and 11-09 lessons.

## What worked

- Comparing the live `<title>` against the source copy for each page before writing new copy.

## Rules

- An SEO copy change is verified on the served HTML (browser user agent), never on the source string.
- One string per page title: the English home reads `pageCopy.home` like every other locale.
