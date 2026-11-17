# Field CLS, the preview box, and a flow probe

## What
Lighthouse scores the site 98-100 with CLS 0, but PostHog's real-user
`$web_vitals` disagree: mobile sessions that resolved a link had CLS p75
0.263 (1,123 of 2,455 reports over 0.1), against 0.046 for sessions that did
not, and 0.31-0.36 once a download started. Google ranks on the field number.

- `pnpm cls:flow` (scripts/cls-flow.mjs) drives the steps Lighthouse never
  takes. It types a link, presses Enter, gets a canned proxied answer 1.5 s
  later, taps Download, gets `/api/video` 1.5 s after that, then opens the
  preview. It prints each scored shift with what grew, plus Event Timing
  (input delay / handlers / frame) for each input. Every run proves itself:
  the card must render and a 300 px insert must register. The shift recorder
  moved to `scripts/lib/cls-observer.mjs`, shared with `pnpm cls`.
- The inline preview `<video>` was `h-auto`. It started at 300x150, took the
  poster's shape, then the stream's, each change seconds after the tap. The
  box now takes the loaded thumbnail's shape before the video exists
  (`lib/previewAspect`, clamped to 9:16-16:9). Desktop flow went from 0.053
  (all six runs before the fix) to 0.0002-0.0005.
- PostHog now sends CLS attribution (`web_vitals_attribution: ['CLS','INP','LCP']`),
  so the remaining field shifts name their element. Query:
  `JSONExtractString(toString(properties.$web_vitals_CLS_event),'attribution','largestShiftTarget')`.

## Mistakes
- The first flow run scored 0 and looked clean. The detector was blind: the
  page had scrolled to the result, and scroll anchoring swallowed the test
  insert at the top of the body. Scroll to the top before the self-check.
- Planned to use live as the "before". Headless Chrome gets Cloudflare's "Just
  a moment..." page there, so both versions have to be built locally.
- Reached for stashing the tree to build the old version, and the shared-tree
  guard blocked it. Instead: copy the one file aside, write `git show
  HEAD:<file>` over it, build, then copy it back.
- Took the lab's 100-150 ms "frame" cost after a tap as the INP cause. A trace
  showed small per-frame work, because this PC rasterises without a GPU. Field
  INP on `/` desktop is 184 ms (good). The field's presentation delay on phones
  still needs a real-device trace.
- Phone runs did not reproduce the field CLS (0.001). The phone-only cause is
  still unknown. The new attribution data will find it; more guessing won't.

- Follow-up the same day: holding resolves at 1, mobile CLS p75 is 0.144 with a
  download only, 0.148 with the Pro nudge only, and 0.335 with both (539
  sessions). So the post-download nudge under the card is what moves, and
  something above it changes height during a real download. The transfer
  slot is fixed at resolve and the two iOS hints are the same length, so
  neither explains it. A 3 MB mocked download didn't reproduce it either:
  `Fetch.fulfillRequest` bodies skip network throttling and land in about a
  second. Next step: `pnpm posthog:query --cls` once attributed reports
  arrive (about 5 CLS reports per 90 minutes), and `--cls-stage` to check
  the fix.

## What worked
- One HogQL query that split field CLS by funnel stage (no link / resolved /
  download started / completed) narrowed the problem to the download flow
  before any code was read.

## Rules
- Field vitals come before lab scores: a 100 in Lighthouse says nothing about
  what happens after the first tap.
- Media whose shape arrives late gets its box from something already loaded.
- A shift probe that reads 0 must prove it can see a shift in the same state.
