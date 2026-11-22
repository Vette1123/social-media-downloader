# Input checks, unsupported-site copy and one retry for Facebook and X

## What
Three PostHog findings over 23 days of human traffic. Text with no parseable host
went to `/api/download` anyway (198 times) and failed. Generic failures on hosts
like t.me and google.com were labelled and worded "private". Instagram, Facebook
and X "private" failures doubled, but only Instagram got the silent second run.

## Mistakes
- The brief said a denied paste chip "fails silently". It does not: `handlePaste`
  already focuses the field and shows `errorClipboard` / `errorLongPress` (Ctrl+V or
  long-press). The 203 "denied" events are telemetry of a handled case, so nothing
  was added there. Read the handler before building a fix for a metric.
- The old resolve test asserted Facebook gets NO retry, which encoded the gap as a
  rule. It now asserts the same for Pinterest.

## What worked
- One `SECOND_TRY_PLATFORMS` set in `resolve.ts`, feeding the existing
  `isRecoverableAnswer`; no second retry loop. Facebook stories join the Instagram
  stories exclusion because they are login-gated too.
- `resolve()` refuses `unknown` platform text itself (`link_rejected` reason
  `not_a_url`), and the paste form shows `errorNotLink` inline, so the batch queue
  and re-picks get the same answer.
- `isUnsupportedHost` in `validator.ts` is the single source for both the banner
  (`friendlyError`) and the analytics label (`failureCode(message, url)`).
- Each test was seen red first: 7 of 10 failed before the change.

## Rules
- A failure on a host we cannot read is "unsupported", never a guess about the post.
- A new retry for a platform goes in `SECOND_TRY_PLATFORMS`, not a new loop.
- New English copy in `errorMessages.ts` needs the four `deep/*.json` entries and
  `pnpm i18n:lock`.
- YouTube resolved to Save: 70% of people who resolve never press Save; of those who
  do, video never failed and audio failed 36% (HTTP 403 past the first megabyte).
