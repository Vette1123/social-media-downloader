# Dailymotion and LinkedIn landing pages

## What

Two new platform pages, `/dailymotion-downloader` and `/linkedin-video-downloader`, are live
in all five languages, with icons, OG cards (the Arabic ones rendered by `pnpm og:ar`),
sitemap entries and hreflang. Every place the site listed or counted platforms (eleven) now
says thirteen. `cf-postbuild` reads the platform count from `platformSlugs.ts` instead of
hardcoding 68.

## Mistakes

- The SEO audit proposed sub-topic pages (TikTok MP3, YouTube Shorts, Instagram story).
  Every one of those is already in its platform page's title, and Instagram stories need a
  login cookie. Building them would have made near-duplicates competing with their own
  parent, and one page promising something we can't do. The real gap was platforms that
  already resolve (Dailymotion 10/10 and LinkedIn 5/7 over 30 days in PostHog) with no page.
- `cf-postbuild` hardcoded the localized page count, so the first export failed with the
  new pages. It is now derived from the registry.

## What worked

- Picking pages from PostHog `resolve_succeeded` by platform: a page only for what works.
- Copying the Vimeo page's wiring touchpoint by touchpoint (grep the slug).

## Rules

- A new landing page goes to a platform that resolves and has no page, never to a sub-topic
  its parent title already names.
- Copy claims come from `validator.ts` URL shapes and `downloader.ts` behaviour, never from
  what the platform offers.
