# Daily sitemap rebuild

## What

The deploy workflow now also runs daily (04:23 UTC), so `sitemap.xml` is regenerated at least once a day, which is
what Bing asks for. Same fix shipped in Reely the same day, where the real bug was a sitemap dropping URLs it had listed.

## Mistakes

None here: this sitemap is a fixed page set with git-based lastmod, so it never drops URLs. Only the schedule was missing.

## What worked

- Checked the release job's `if: github.event_name == 'push'` before adding the cron, so a daily run publishes no empty release.

## Rules

- A site that only deploys on push has a sitemap as old as its last commit; give it a daily schedule.
