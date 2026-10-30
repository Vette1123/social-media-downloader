# PostHog to the Reely standard, plus the Worker

## What
Added PostHog from nothing. One typed layer (`src/lib/analytics.ts`) covers the
funnel link → resolve → download, every control, every swallowed catch, and what
was downloaded (platform, cleaned link, title, author, length, size). `resolve()`
reports for every surface. The Worker reports its own 5xx and throws with a plain
`fetch` (`serverAnalytics.ts`). Three dashboards, four alerts and the four
`posthog:*` scripts are applied from `scripts/posthog-dashboards.mjs`.

## Mistakes
- **Planned the SDK with no download content, then had to add it.** The first
  design scrubbed all links as a privacy rule, without asking what the owner
  wanted from the data. The cost was one module written twice.
- **The privacy page promised the opposite in three places** ("we do not log the
  links", "no download activity is recorded", "the only analytics"). Only found
  because the page was read before shipping. It changed in the same commit.
- **`seenBefore` looked for `smd_` keys; most of the app uses `smd:`.** Every
  existing visitor would have fired a false `first_download`. Found by listing
  the real keys, not by a test: the test was written after.
- **Python text-mode writes on Windows produced CRLF**, so the coverage test's
  regex matched no helpers and reported every event as dead. A batch edit script
  also stopped halfway on an assertion and was not idempotent, so rerunning it
  meant trimming what had landed.
- **`href='/pro'` as a match string also matched deeper-indented lines.** The
  assertion on match count is what caught it.
- **The first deploy failed at `pnpm install`: `core-js` (via posthog-js) has a
  build script nobody had approved or denied.** Every local check passed because
  this machine's user pnpm config sets `dangerouslyAllowAllBuilds`, which hides
  the error. Reported as pushed before the run was looked at; the site stayed on
  the old build meanwhile.
- **`requestIdleCallback(fn, { timeout: 2000 })` was treated as a 2 s delay.** It
  is a ceiling: on the live site the SDK started 37 ms after `load`, and a first
  scroll or a stray error could pull it earlier. Lighthouse cannot show this,
  because the bot gate keeps the SDK out of its runs, so its scores looked clean.

## What worked
- `resolve()` as the choke point: paste box, batch, re-pick and retry are all
  counted without a line at any of those call sites.
- `data-pro-cta` plus one document listener, because half the links to /pro are
  in server components.
- `ph-no-capture` on results and Recent: one class keeps them out of autocapture
  and blocks them in replay.
- A `--prune` flag on `posthog:setup`, so "only these three" is a repeatable state.

## Rules
- A privacy page is a spec. Read it before adding any collection, and change it
  in the same commit as the code.
- Adding a field to `contentProps` means re-reading what that page promises.
- List real storage keys before writing a prefix test against them.
- Batch edit scripts open files with `newline=''` and assert match counts.
- A Lighthouse score only counts for code the run actually loaded. Check the
  chunk is in its network list, and time gated code in a real browser.
- Alert floors are guesses until a week of traffic exists: re-read them then.
- After adding a dependency, run `pnpm install --frozen-lockfile
  --config.dangerouslyAllowAllBuilds=false` in a clean copy. A plain local install
  cannot fail the way CI does. On failure pnpm writes a placeholder key into
  `pnpm-workspace.yaml`, so never run it in the real checkout.
