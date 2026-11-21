# X: a deleted or protected post is an answer, not "may be private"

## What
After #76 (FxTwitter as second host) a live check of a non-existent post still said "may be private,
age-restricted, or unavailable" (`inconclusive`). FxTwitter answers that case definitively with JSON
`{code: 404, message: "NOT_FOUND"}`, and protected accounts with `401 PRIVATE_TWEET`, but `http.get`
threw on the status and the chain fell through to Cobalt and the guess. Now those two JSON verdicts
throw `TWEET_NOT_FOUND` (unavailable) / `TWEET_PROTECTED` (private), and the chain ranks any
definite verdict over the guess, like it already did for text-only posts.

## Mistakes
- #76 was verified only on posts that exist, so the most common reason a real X link fails (deleted)
  still produced the vague message and the `inconclusive` code the watcher files issues on.

## What worked
- Testing production with a deliberately dead ID, then asking the API directly what it says.

## Rules
- A verdict needs the service's own JSON, never a bare status: a blocked edge can 404 too (pinned).
