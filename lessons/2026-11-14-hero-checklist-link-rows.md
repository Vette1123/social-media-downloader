# Hero checklist and link rows on phones

## What

- **Repeated promise.** The line above the paste bar says "Free, no account,
  no limits. Support the project →", and the checklist under it repeated
  free, no login and no limits. The checklist was the part to cut: PostHog
  shows the line's link is the top support CTA (`hero_line`, 14 people in 30
  days, ahead of the account menu's 13). On home the checklist is now
  `homeHeroChips`: "HD quality" plus the "Any public link" link, one line on a
  320 px phone. Platform pages have no hero line and keep all four chips.
- **Lone Nafis card.** Five link cards at half a row each wrapped 2 + 2 + 1.
  LinkCard takes `phoneWidth`: the dev links keep half a row, the three apps
  take a third, so the rows read 2 + 3. The apps icon is the same on all three
  and hides below `sm`, which is what lets "Masareef" fit a third of a 320 px
  row.
- The support link is `whitespace-nowrap`, so it no longer breaks as
  "Support the / project →" at 320 px.
- `pnpm shots --phone-width 320` checks the narrowest phone.

## Mistakes

- Took a single Lighthouse run as a regression. Home mobile TBT read 61 ms
  before and 186 ms after, against a 150 ms budget. Two A/B rounds at 5 runs
  each, in both orders, gave medians of 96/85 ms (before) and 179/131 ms
  (after). Comparing long tasks per report settled it. Both builds have the
  same tasks at the same offsets: the document task at about 800-900 ms (about
  145 ms) and the main chunk at 2706 ms (about 140 ms). The gap is outlier
  runs where every category inflates at once (`other` 719 ms against about
  470 ms typical), on a box at 64% CPU from other sessions. CSS classes and
  fewer DOM nodes add no main-thread work.
- `cn` here is bare `clsx`, not tailwind-merge. A second `basis-*` class would
  have lost to stylesheet order, which is why width became a prop rather than
  a className override.
- `pnpm perf --routes /` from Git Bash needs `MSYS_NO_PATHCONV=1` like
  `shots`, or the route is rewritten into a Windows path.

## What worked

- Asking PostHog which copy earns clicks before cutting copy.

## Rules

- Before cutting one of two places that say the same thing, check which one
  people click.
- Read Lighthouse TBT as a spread over several runs (`--runs 5`), compare
  against a baseline taken in the same minute, and settle a gap from the
  long-task list in the reports (left in `%TEMP%/perf-audit-*`), not from the
  median.
