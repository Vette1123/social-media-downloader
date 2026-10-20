# The reel that waited for everyone who was slow

**Date:** 2026-10-20
**Scope:** `src/lib/downloader.ts`, `src/lib/resolve.ts`, `src/lib/downloaderInstagramVideo.test.ts`

## What

An Instagram follow-up report: downloads "take much time" and the download
button "fails on the first click, works on the second". Measured live against
production with cache-busted `POST /api/download` calls before touching
anything: a reel answered `422 "Instagram is rate-limiting this downloader …
give it a few minutes"` in ~2.5s, repeatedly, across attempts
ten-plus minutes apart — the rate-limit state was chronic, not transient, and
the copy's promise ("a few minutes") went unmet as long as the egress address
kept earning fresh 429s. A `/p/` carousel answered in ~600ms, so the wall was
reel-shaped.

The reel chain ran four extractors strictly in order: embed → crawler view →
media-info → Cobalt. For a `/reel/` link the embed has nothing extractable
(`is_video: true`, no `video_url`, by design) yet still cost a fetch, and
Cobalt — the one rescue that tunnels a stream from any IP — waited at the back.
Sequentially, a stalling or rate-limited upstream was paid in full before the
next method was even asked.

Fix: the chain now judges one method through a shared `runAndJudge`
(probe/catch/park, extracted verbatim from the old sequential loop) and runs
the three video-hunters crawler/media-info/Cobalt through `firstResult` — the
race shape `downloadTikTok` already runs (2026-08-14 lesson, applied to its own
platform first). The embed runs alone first, but only when the URL's own shape
has not already said "video" (`/reel/`, `/tv/`), which it always has for the
case that mattered. Also: the client's `POST /api/download` fetch got one retry
for thrown network errors only — the resolve-side twin of the two-taps lesson's
download-side retry, user-abort excluded from what counts as retryable.

## Mistakes

**The embed test I wrote first encoded a format that doesn't exist.** I built
the fixture with `Buffer.from(JSON.stringify(media)).toString('base64')` for
`contextJSON`, and that field is a JSON-encoded string — `JSON.stringify` of
`JSON.stringify` of the payload — not base64. The double-`parse` in
`extractContextJson` (the thing the caption on that function documents) reads
text, not bytes. Base64 is what `efg` video-URL params carry; the two live a
few hundred lines apart and one borrowed the other's codec.

**I nearly shipped a second failing `stillsOnly` shape.** Extracting the
per-method judgement into the `runAndJudge` closure moved the writes of
`unverifiedVideo`/`stillsOnly` out of the surrounding function's control flow —
TypeScript narrows a `let` only a closure writes to `never`, and the read site
became a programming error rather than a type error. Parked facts moved into
one mutable `held` object instead. The same trap is lying open for the next
person who extracts a loop body into a helper.

**Redoing a single failed probe twice, ten minutes apart, and reading it as
"it recovered in the window sometimes"** — the second look was as red as the
first; only the `FAIL` copy's hindsight made the first one look special. Don't
re-believe the message copy against evidence, even when the copy came from this
repo's own throw.

## What worked

- **Stopwatch before diff.** Two live resolve timings against production took
  the question from "where might it be slow" to "the crawler 429 wall is the
  failure; the chain order is the latency" in one round trip.
- **`firstResult` already existed** with a comment stating exactly its
  conditions ("independent upstreams of comparable quality, both slow");
  Instagram video-hunters meet both. A fourth extract of the same race would
  have been harder to review than the race shape.
- **Judging inside the race, not after it.** Each racer is probed and parked by
  the same code the sequential loop used, so a race win is indistinguishable
  from a sequential win — and the output-word log (`embed:nothing
  crawler:nothing …`) still describes precisely what refused, now including
  racers.

## Rules

- **A chain of independent extractors is a race wearing a queue's clothing.**
  When the first-in-line is a surface that chronically rate-limits (and cools
  for ten minutes when it does), racing is not an optimization; sequential is
  the bug.
- **An extractor that design-side produces nothing for a link shape should not
  be fetched for that link shape.** `/reel/` links paid 260 KB per resolve for
  an `is_video` flag the URL already carried.
- **A `let` written only from inside a closure reads as its initializer's type
  at the call site.** Hold closed-over mutable results in an object, or the
  type checker will tell you the parked value can never be there.
- **A message that says "give it a few minutes" needs the minutes to exist.**
  Chronic rate-limits deserve wording about the cause, not a promise the
  cooldown can't keep.
