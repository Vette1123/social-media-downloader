# Facebook share links: say where they landed

## What

#67 and #69 (Facebook `/share/r/*` and `/share/v/*` links, code `inconclusive`) came back with 41
failures in 4 days. `resolve_failed` only named the pasted share link, so the post form behind
them couldn't be reproduced. Now `landedFailure()` attaches the shape of the page the redirect
walk ended on, `resolveFailure` returns it as `landed`, and the client puts it on
`resolve_failed`. Shapes only: no ids, no names, no query values.

## Mistakes

- None in the code. The diagnosis nearly went wrong: "inconclusive on a share link" read like the
  12 s share hop timing out. `duration_ms` (p10 3.0 s, p50 5.0 s, p90 7.3 s) shows Facebook
  answered every one, and the post it led to then failed in all four extractors.
- No public share link to reproduce with exists in the repo or on the web, and the one in a
  scraper sample is walled now. So this fix adds the trace, not an extractor change.

## What worked

- Ruling out the timeout from data already collected, before adding a new property.
- Public reels resolve in production (200, about 0.5 s) and through `pnpm link:probe`.

## Rules

- Next time #67/#69 reopen, group `resolve_failed` by `landed`. That names the post form to
  reproduce with `pnpm link:probe` before touching the Facebook chain.
