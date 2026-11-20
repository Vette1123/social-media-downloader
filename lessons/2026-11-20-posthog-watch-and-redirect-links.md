# PostHog watch, redirect-wrapper links, home snippet

## What
- `pnpm posthog:watch` (daily `.github/workflows/posthog-watch.yml`, 06:17 UTC) reads 3 days of
  PostHog and files one GitHub issue per problem: a supported host routed to `generic`, one link
  shape failing for 4+ people, a platform failing 30%+ for 6+ people, an error kind reaching 3+
  people, or fewer than 15 downloads in 24 h. Rules: `scripts/lib/posthog-watch-rules.mjs`.
  Open issues are updated in place; closed-completed reopens only when the close predates the
  whole window; closed-not-planned stays closed. `POSTHOG_API_KEY` is now a repo secret.
- `extractLink` peels outbound-link wrappers (Google `/url?url|q=`, `l.facebook.com/l.php?u=`,
  `l.instagram.com/?u=`, YouTube `/redirect?q=`). Google wrappers failed for 5 people a week.
- Home meta description names "online", "audio" and "photos" (Search Console: ~3k impressions
  a month on those queries at 0.7-4.8% CTR) and keeps the exact "social media video downloader".

## Mistakes
- Read "Google sends 1 visitor" off a PostHog table whose top row `tail` had cut. Search Console
  said 2.6k clicks; the bug was the pipe, not the tracking. Print the header with the rows.
- The first watcher rules filed `private`/`unavailable` verdicts, expected network drops
  (`download:image_item`, all `expected: true`) and Telegram (served by `generic` on purpose)
  as bugs: 13 findings, 5 of them noise. A dry run against real data before filing caught it.
- A 7-day failure table mixed events from before today's four fixes. Cut by deploy time first.
- `sed` in Git Bash ate the escapes in `/^https?:\/\//`; the test still passed because the
  broken regex was never reached. Use the Edit tool for regex literals.

## What worked
- 6 real `vt.tiktok.com` links from public GitHub issues all resolved via `pnpm link:probe`,
  so TikTok short-link failures are dead posts, not a routing bug.
- `posthog:watch --dry` before the first real run.

## Rules
- A watcher files only what a person would act on: exclude verdict codes and expected errors.
- Issues land in a public repo: hosts, id-free shapes, codes and counts only.
