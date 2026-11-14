# Embed-only notice, empty-submit paste, support panel count

## What

PostHog, 30 Oct to 14 Nov 07:45 UTC (before today's deploys), real people only:
1706 landed, 1369 submitted, 1096 resolved, 781 started, 732 completed.

- **YouTube embed-only results.** 242 people resolved a YouTube link that
  came back as an embed with no video stream. 28 started a download and 4
  completed. The card already had honest copy ("direct download isn't
  available", "grab the MP3 below"), but that line only rendered inside the
  preview, which is collapsed by default. The card read as a success with
  nothing to save. `lib/embedNotice.ts` now decides the notice, and it sits
  above the download buttons as a `role=status` line.
- **Empty submit.** 226 people (13% of landers) pressed Download on an empty
  box and were told to paste first. The tap is a user gesture, so it now runs
  the Paste chip's clipboard read, unless the browser has already refused it
  (`emptySubmitReadsClipboard`). Tracked as feature `empty_submit_paste` and
  link source `empty_submit`.
- **Support panel.** The copy said "switches these four on", then listed all
  12 benefits. The panel now shows 4 (`PANEL_BENEFIT_INDEXES`) and links to
  /pro with "See all 12 features" in all five languages.

## Mistakes

- The first placement put the notice under the download buttons, where "grab
  the MP3 below" pointed at nothing. Moved it above them before shipping.
- The other findings (generic links read as "private", failures ending the
  session, dead clicks on chips and feature cards) were already addressed by
  today's earlier deploys. The data predates them, so they are not reworked
  here; re-measure first.
- `pnpm cf:startup` needs `wrangler deploy --dry-run --outdir
  .worker-size-check` first, as CI does. Run bare, it fails on a missing
  folder, not on a budget.

## What worked

- Asking the funnel which step loses the most people, then reading the code
  behind that step, found a case where the explanation existed but wasn't
  shown.

## Rules

- A result that can't be saved must say so on the card, never only inside a
  collapsed control.
- Copy that names a count ("these four") gets a test that pins the count.
- Re-measure the funnel after 21 Nov: `content_type=embed` start rate,
  `link_rejected reason=empty` count and `empty_submit_paste` outcomes.
