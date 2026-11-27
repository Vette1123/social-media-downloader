# Sweep, 27 Nov: the payment-provider guard timed out; Bing checked by hand

## What

- Checks: lint, typecheck, seo:verify 95/95, PostHog 0 open, CI 10/10 green. #88 stays open as
  the Cobalt tracker (already re-checked today).
- `pnpm test` failed 1 of 1990 on the first run: `src/config/support.test.ts` "no tracked file
  outside history names it" hit the 5 s timeout at 11.7 s. It read every tracked file with
  `readFileSync` over `git ls-files`, skipping binaries by an extension list. It now runs
  `git grep -l -I -i -E` (0.9 s for the file), the same fix Reely shipped in #260, and a second
  test proves the scan finds a name that is there. Seen red with `buymeacoffee` planted in
  `src/config/support.ts`, green without; full suite 1991/1991.
- Bing (portfolio-v1 `lib/bing-check.mjs`, site swapped): 26 Nov crawl 13 URLs, 68 in index,
  0 errors. 2 BlockedByRobotsTxt, which are the disallowed paths.
- GSC: titles stay frozen until the 2026-12-01 core-update re-check
  ([2026-11-22-triage](2026-11-22-triage.md)). `/telegram-downloader` and
  `/id/telegram-downloader` are "unknown" and roll to the next Request Indexing run; today's
  account quota was spent by the earlier sweeps.

## Mistakes

- The guard was written with the readFileSync walk after Reely had already learned (25 Nov)
  that it times out on Windows. The lesson lived in one repo, the test in two.

## What worked

- Porting Reely's fixed test verbatim instead of tuning a timeout.

## Rules

- A test that scans the repo uses `git grep`, never a `readFileSync` walk over `git ls-files`.
- When a fix lands in one repo, grep the sibling repo for the same pattern before closing.
