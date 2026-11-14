# PostHog check: caught 500s carry their reason, focus taps stop counting as dead clicks

## What

A PostHog review found one open issue, "WorkerResponse: [/api/download] HTTP 500". The
Worker reported the status and nothing else, so the issue could not be acted on. A 5xx now
passes a clone of the response to `reportServerFailure`. The response body's error text is
read inside `ctx.waitUntil`, after the visitor already has their response, and becomes the
exception message. The home page's "frustrated people" tile counted 55 dead-clickers on the
link `<input>`. Those were taps that only focused it, so `beforeSend` now drops a
`$dead_click` whose element is an input, textarea or select. Rage clicks on the box still go
through.

## Mistakes

- The first `FOCUSABLE` regex used `\b`. A hyphen counts as a word boundary, so it matched
  `input-group` class chains. The fix uses `(?![\w-])`, and a test pins the case.
- The empty "who is here: pro" column looked like a live bug. A breakdown by hour showed it
  had already been fixed on Nov 13. Check by hour before re-fixing a tile.
- `pnpm cf:startup` failed with ENOENT on its own. It needs
  `wrangler deploy --dry-run --outdir .worker-size-check` first, the same way CI runs it.

## What worked

- The red check, done by copying the file to the job tmp folder (stash is blocked), proved
  each new test fails without its fix.

## Rules

- A server failure report includes a reason, not just a status. Read the body only after
  the response has been sent.
- Before trusting the dead-click count, remove the clicks that were only focus.
