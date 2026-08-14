# The slow platform was not slow, and the broken one was never reached

## What

Two reports: TikTok takes far too long to resolve, and Facebook does not work.
They turned out to be unrelated and neither was a regression from the last
release — `git diff 9c23f9f..HEAD -- src/lib/downloader.ts` touches no TikTok
line at all.

TikTok's chain asked tikwm first and Cobalt only if tikwm missed. Measured
against production, one cold resolve was **16.0s** end to end; measured against
the upstreams directly, tikwm answered in 13.2s while reporting 2.1s of its own
`processed_time` — the rest is its queue — and Cobalt answered the same URL in
8.3s. So every visitor paid tikwm's queue in full before the faster of the two
was even asked. The two are now raced (`firstResult`), and the sequential
fallbacks (yt-dlp, the public scrapers) stay behind them.

Facebook was reached through `resolveRedirect`, which follows short links with a
browser user agent. Both shapes Facebook's own share sheet produces —
`facebook.com/share/<v|r>/<code>` and `fb.watch/<code>` — answer a browser with
**400** and redirect only for a link crawler. So the canonical URL was never
recovered, and every Facebook extractor was handed a `/share/` URL that the
video plugin answers with an error page. Those two shapes now resolve with
`HEAD` and a crawler user agent.

## Mistakes

- **Reached for the release diff first, and it said nothing.** The report was
  "since last release", so the first hour went into `git log`/`git diff` looking
  for the change that caused it. There wasn't one: the code was identical and
  the upstream had degraded underneath it. What actually answered the question
  was timing the two upstreams directly, which should have been the first move
  on a *latency* report — a diff explains behaviour changes, not latency.
- **Nearly reported "download is slow" as a download problem.** The proxy was
  measured only after the resolve was: `/api/video` streams at 1.5–3.2 MB/s with
  a 0.3–0.5s TTFB. Every second the user was waiting was in front of the first
  byte. Timing the wrong half would have sent the fix to the wrong file.
- **The one measurement that looked decisive was not reproducible.** tikwm took
  13.2s in the morning and under 1.3s an hour later for three fresh URLs. Its
  latency is variable, not fixed — which is an argument *for* the race and
  against the reordering that was the first idea (put Cobalt first): whichever
  one is slow today, the race takes the other.
- **First cut of the Facebook poster took the page's first `<img>`.** That works
  on a reel embed and picks up a `static.xx.fbcdn.net` spacer gif on a watch
  embed — a thumbnail that renders as a blank box. Both pages had to be looked
  at before the rule (`/t15.`, the CDN path segment Facebook puts video
  thumbnails under) was right.
- Wrote the share-link helper as `isMetaShareLink`, covering Instagram too,
  before checking: Instagram's `/share/` links answer a browser normally. Narrowed
  to Facebook rather than ship a behaviour change nothing asked for.
- `pnpm cf:build` fails with `EPERM: rmdir 'out'` while `wrangler dev` is
  running. Stop the dev server before rebuilding.

## What worked

- Timing each layer separately — upstream, resolve, proxy — before touching
  anything. Four `curl -w` runs located the entire problem, and the numbers are
  in the code comments now so the next person does not re-derive them.
- Asking the same URL twice against production and reading `X-Cache`. MISS 16.0s
  / EDGE 0.16s is what proves the cost is in the resolve and not the network.
- Probing the origin with each user agent in turn (`-w '%{http_code} %{url_effective}'`,
  no `-o`). Browser 400 vs crawler 302-to-canonical is the whole Facebook bug,
  visible in two commands and invisible from the code.
- Verifying in `wrangler dev` and then fetching the returned media with a Range
  request — 206 `video/mp4` for the video, 200 `image/jpeg` for the poster.
  Per the last sweep's rule: `success: true` is not evidence.

## Rules

- A latency report is answered with a stopwatch, not a diff. Time each hop
  before reading any code — the cause is often an upstream that got slower with
  no commit behind it.
- Two independent upstreams of comparable quality, both slow, both unreliable:
  race them. Sequencing makes every caller pay the first one's worst day, and
  reordering only moves which day is bad.
- A measurement taken once is an anecdote. Re-measure before designing around
  it; tikwm moved by a factor of ten within the hour.
- Before assuming an extractor is blocked, check that the URL it was handed is
  the canonical one. A short-link resolver that quietly returns its input on
  failure turns "cannot resolve the link" into "the post must be private".
- When a host serves different content per user agent, the crawler view is worth
  trying for redirects too, not only for markup.
