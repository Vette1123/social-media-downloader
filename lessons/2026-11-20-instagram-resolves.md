# Instagram resolves: the first click failed, the second worked

## What

PostHog, last 2 days: 283 successful vs 62 failed Instagram resolves from 24
people. Last 7 days, failure codes: `private` 106 (38 people), `rate_limited` 33,
`network` 8, `inconclusive` 5. The odd 4-letter query keys on the failing shapes
are only the privacy-scrubbed form of `igsh`/`utm_*` (`linkShape`); production
resolves the same public reel identically with no query, `?igsh=`, `?utm_source=`
and `/reels/` (8 of 8 consecutive runs also succeeded, 0.9-6.6 s). Query-string
handling and shortcode parsing are not the bug.

The give-up line ("...private, age- or region-restricted, or has been deleted")
is thrown when every method in the chain comes back empty, which also happens
when a cold first request loses the race (crawler cooling down, Cobalt instance
slow). A same-person fail-then-success within 120 s happened 62 times for
`private` (13 people, ~54 s gap, failed after ~4.4 s), 14 for `rate_limited`
(3 people) and 4 for `network` (3 people). That is the "fails on first click,
works on the second" report.

Fix: `resolveOnServer` (`src/lib/resolve.ts`) now silently re-asks once, behind
the same loading state, when an Instagram answer fails with a recoverable code
(`isRecoverableAnswer`); stories/highlights are excluded.

## Mistakes

- Took the odd query keys for the cause. They are the scrubber's output, not the
  user's links. Replaying real shapes against production ruled it out in minutes.
- Could not reproduce the first-click failure on demand (8/8 passed); the
  evidence is the PostHog pairs, not a repro.

## What worked

- A self-join of `resolve_failed` to the next `resolve_succeeded` for the same
  person turned an anecdote into a count.

## Rules

- A chain's "private" give-up is a guess; never treat it as final on the first
  run. Retry once where the visitor cannot see it.
- Only the final answer of a resolve is tracked, so the first failed run is no
  longer in `resolve_failed`; judge the fix by the failure rate falling.
- The server-side cause (which method comes back empty cold) is still
  unmeasured; log `outcomes` per resolve before changing the chain.
