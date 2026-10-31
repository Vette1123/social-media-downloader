# Dependabot and two bumps

## What

Bumped motion and posthog-js, with `pnpm audit --prod` at 0 and 1167 tests passing. Replaced `fluent-ffmpeg` with `spawn` and `src/lib/slideshowArgs.ts`. Turned on
Dependabot alerts and automated security fixes in the repo settings.

## Mistakes

- **Ran `pnpm cf:startup` without its folder and read the crash as a bundle problem.** It needs
  `wrangler deploy --dry-run --outdir .worker-size-check` first, as the workflow does.

## What worked

Checking the repo before upgrading showed the Next work was already done.

## Rules

Replace a deprecated wrapper around one command with `spawn` and a pure argument builder.
