# Layout-shift CI check only when layout can change (2026-11-13)

## What
`scripts/cls-audit.mjs` took 2m15s of a ~4.5 min deploy on every push, including
README- and FUNDING.yml-only pushes. `scripts/layout-changed.mjs` diffs the push
and the deploy workflow skips the check when every file is docs, lessons, tests,
tooling or a side workflow. Unknown files count as layout. Manual runs always check.

## Mistakes
- First draft treated every top-level script as tooling; `cf-postbuild.mjs`
  rewrites build output and `headerRules.mjs` sets response headers, so both can
  change what paints. Caught by reading `cf:build` before shipping.
- First version diffed from the push's `before`. Within minutes a delayed
  scheduled run superseded the pending push run that changed the deploy
  workflow, skipped (it diffed against itself), and the next push diffed from
  there: a layout-relevant change deployed unchecked. The baseline is now the
  last commit the check really PASSED on, read from the run history.
- Same push window: a deploy failed on Cloudflare's D1 `binding DB ... failed to
  generate` (10021). It is their API, transient; `gh run rerun --failed` fixed it.

## What worked
- Allow-list of inert paths instead of a list of "layout" paths: a new kind of
  file runs the check by default.

## Rules
- A CI step that costs minutes gets a cheap "did its inputs change" gate first.
