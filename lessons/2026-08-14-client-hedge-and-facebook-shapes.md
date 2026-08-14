# The server was never the slow half

## What

A follow-up to [the same day's latency work](2026-08-14-tiktok-latency-facebook-share.md).
That fix raced TikTok's two upstreams *inside the Worker* and took a cold resolve
from 16.0s to about 1s — and the report came back unchanged: still slow.

The reason is that a TikTok paste never starts at the Worker. `lib/resolve.ts`
calls tikwm **from the browser** first, because a residential IP is not walled
and the CDN URL it returns streams straight to the visitor. That call was
`await`ed outright with a 6s leash, and only its failure led to
`POST /api/download`. With tikwm queueing, every paste paid 6s of leash and then
a full server resolve: 7–9s, none of which is visible from the server side.

It is now a hedge. The browser attempt runs alone for 700ms; past that the server
is asked as well and the first real answer wins. Measured in Chrome against the
local Worker, twice: tikwm called at t+25ms, `/api/download` at t+727ms, card
on screen at 2.1s and 2.2s.

The Facebook side of the report was "stories, all missing, handle it all". The
validator only recognised `/videos/`, `/reel/`, `/watch`, `/share/[vr]/` and the
`*.php` permalinks, so every other shape Facebook's own UI produces was rejected
as an unsupported platform before any extractor ran. Added: `/share/p/` (a post
share), `/<page>/posts/`, group posts, photo links, stories, and the `mbasic.`
host. Photo links resolve to the photo. Stories now say what is wrong with them
instead of failing four ways.

## Mistakes

- **Fixed the half that was measurable instead of the half that was slow.** Every
  measurement in the first pass was `curl` against `/api/download`, which is a
  path a real TikTok paste only reaches *after* the browser's own attempt gives
  up. The server work was real and worth keeping, but the user-visible number
  barely moved, and the report coming back a second time is what forced reading
  the client. Measure the path the user actually takes, not the one that is
  easiest to time.
- **Two rounds of "still slow" could have been one.** `resolve.ts` is 90 lines
  and names `resolveTikTokInBrowser` on line 55. Reading the entry point the UI
  calls, before timing anything, would have found the 6s leash immediately.
- **First cut of the hedge was three racing promises and a hand-rolled
  AbortController.** It was hard to reason about whether a null could end the
  race early. Rewritten as two plain steps — race the browser attempt against a
  700ms timer, then race it against the server — which is shorter and obviously
  correct.
- **Facebook stories were "not working" only in the sense that nothing could
  work.** They redirect to `login.php` for every client, crawler included, so
  there is no open surface. That was worth five minutes of probing before any
  code: the deliverable is an accurate error, not an extractor.
- **The photo path nearly shipped able to fake a success.** Every Facebook page
  publishes an `og:image`, a private video's poster frame included. Gating it on
  the URL naming a photo is the only thing stopping a private video from
  resolving "successfully" as its own thumbnail — the exact failure the previous
  sweep caught with Vimeo.
- Could not verify the photo path against a live public photo URL: the one
  candidate found was already unavailable, and Facebook's photo permalinks are
  not harvestable from a crawler view. It is unit-tested and unverified in
  production, and this file is the record of that.

## What worked

- Driving the real UI with browser-harness and hooking `window.fetch` to print a
  timestamp per outbound call. Two numbers — tikwm at t+25ms, `/api/download` at
  t+727ms — prove the hedge fires exactly when it should, which no unit test can
  show.
- Probing each URL shape with `curl -o /dev/null -w '%{http_code} %{url_effective}'`
  before writing a pattern for it. `/stories/` answering `login.php` and
  `mbasic./m./web.` all normalising to `www.facebook.com/reel/<id>` were both
  facts, not guesses.
- Hedging rather than shortening the timeout. A shorter leash makes the fast case
  worse; a hedge leaves it untouched and only bounds the slow case.

## Rules

- Before optimising a request path, find the entry point the UI calls and read it
  end to end. A server measurement is only the whole story if the client goes
  straight to the server.
- Never `await` a third party on the critical path with a long timeout as the
  only escape. Hedge it: let it run, start the fallback after a short delay, take
  the first answer.
- A path that reads `og:image` must be gated on the link naming that media type.
  Every page has one, so an ungated fallback turns "cannot extract" into a
  confident wrong answer.
- When a platform surface is login-only, ship the accurate error and say so in
  the lesson. A clear "this cannot work here" beats four extractors failing.
- Say plainly which paths went out unverified. `pnpm test` passing is not the
  same as a live URL answering.
