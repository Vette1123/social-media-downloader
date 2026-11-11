# The smoke suite paces itself under our own rate limit

## What

`cf-smoke` runs 6 checks at once. On a warm pass 2 its `/api/download` calls
outran the zone's 30-per-10s-per-IP rule (`RATE_LIMIT_RULE`,
`scripts/cf-setup.mjs`), and Twitch and Dailymotion got Cloudflare's HTML 429.
Every extractor call now waits on `createPacer` (`scripts/lib/request-pacer.mjs`,
24 per 10 s). A 3-pass production run had no 429.

## Mistakes

- The first report called it "our own rate limit, passes alone" and moved on.
  That left a deploy gate that fails at random, which teaches you to re-run it
  until it goes green.
- I tried to reproduce it once, and the run passed. The evidence was the
  earlier failure text: a 429 with an `<!doctype html>` body, which is the
  zone's block page rather than the app's JSON.

## What worked

- Reading the rule's numbers from `cf-setup.mjs` instead of guessing a delay.
- A fake clock that only moves when the pacer sleeps, so the "never more than
  N in any window, six workers at once" property is checked exactly.

## Rules

- A test client of a rate-limited endpoint paces itself below the limit, with
  the limit's source named next to the number.
