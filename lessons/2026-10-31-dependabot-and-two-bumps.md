# Dependabot and two bumps

## What

Bumped motion and posthog-js, with `pnpm audit --prod` at 0 and 1167 tests passing. Turned on
Dependabot alerts and automated security fixes in the repo settings.

## Mistakes

No wrong turn here. This repo was already on Next 16.4.3.

## What worked

Checking the repo before upgrading showed the Next work was already done.

## Rules

`fluent-ffmpeg` is deprecated upstream, so treat its replacement as open work.
