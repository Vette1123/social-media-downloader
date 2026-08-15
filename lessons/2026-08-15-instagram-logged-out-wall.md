# Two bad samples and I declared Instagram dead

Follows [2026-08-13 — the Instagram session was fine; every path that used it
was dead](2026-08-13-instagram-media-api.md).

## What

Production logged `Instagram extraction failed and IG_SESSIONID is not set` on
failing downloads while the secret was set and valid. Fixing that lie was
correct. The conclusion I built on top of it — *Instagram has closed every
logged-out surface, nothing can be done* — was wrong, and I wrote it into the
README, the error copy and this file before the samples were checked.

What is actually true, verified from a Worker on Cloudflare's own network
against four famous public posts (the egg, three of the most-viewed reels):

| | Result |
| --- | --- |
| Embed page, logged out, from Cloudflare | resolves reels, single photos and a 10-image carousel |
| `co.otomir23.me`, logged out, from Cloudflare | `status: redirect` + a real CDN URL |
| Full anonymous `Downloader` | 4/4 public posts |

And what is genuinely dead, independent of the post:

| Surface | Logged out | With session |
| --- | --- | --- |
| Web GraphQL `doc_id=8845758582119845` | `{"errors":[{"message":"execution error","severity":"CRITICAL"}],"data":null}` | **identical** |
| ...with a `doc_id` harvested from Instagram's own bundle that day (`PolarisPostRootQuery_instagramRelayOperation = 28067070969622724`) | same | — |
| `/p/<sc>/?__a=1&__d=dis` | 404 | 404 |

So: the GraphQL extractor is removed (the server refuses the *query id*, not the
post — nothing to re-point), and Instagram otherwise works for the public
exactly as before.

## Then the `ig` grant turned out to be broken too — twice over

Testing every content shape against the credentialed path found two more
things, one a real bug and one self-inflicted:

- **Story links had been failing for `ig` accounts while highlights worked.**
  The path resolved `username -> user id` through `web_profile_info`, which
  answers 429 under any real use. Highlights carry their own reel id and never
  touch it, which is exactly why the failure looked random. A story link already
  carries the item's own media id, so it now asks `media/info` for that item
  directly and never looks the account up; the reel route remains as a fallback,
  with the username resolved through blended search (exact match only, or
  `/stories/nasa/…` could resolve to `nasa_fanpage`). Five tests in
  `downloaderStory.test.ts` pin it, including "sends nothing at all when
  uncredentialed".
- **I got the burner account locked.** After a few hundred probe requests in an
  hour, every private endpoint started answering
  `{"message":"checkpoint_required","lock":true}` — `media/info`, search, even
  `accounts/current_user`. It had answered 200 thirty minutes earlier. Nothing in
  the code can recover from this: someone has to sign in as that account in a
  browser, clear the challenge, and re-upload `IG_SESSIONID` and its companion
  cookies. Diagnosing it took far longer than it should have because every
  endpoint just returned "no items", so `logInstagramRefusal` now names the
  three states apart — locked account, stale cookie, refused media id.

## Mistakes

- **I proved a negative from two unrepresentative URLs.** One shortcode I invented;
  the other came from a test fixture and belongs to a small verified account
  whose reel Instagram does not serve logged-out. Both returned the same "the
  link to this photo or video may be broken" shell — which is *also* what a
  deleted post returns, and what a restricted post returns. Three causes, one
  response body. I read it as "the surface is gone" and wrote a README warning,
  a rewritten user-facing error and a lesson file saying Instagram was finished.
  The very next probe, against posts that are public beyond argument, resolved
  4/4.
- **The earlier draft of this file listed "prove the sample is live" as a rule
  while the conclusion above it violated it.** I checked that the sample post
  existed (it resolved with our session) and stopped there. Existing is not
  public. `is_private: false` on the *owner* plus a logged-out resolve by any
  third party is the check that matters.
- **A third party contradicted me and I nearly explained it away.**
  cobalt.directory's `/api/tests` said Instagram was "Working, returned valid
  status" on a dozen instances, timestamped that morning, while my probe got
  `error.api.fetch.empty` from those same instances. The honest reading of a
  fresh contradicting measurement is that my input differs, not that their test
  is stale.
- **The log line lied first, and that framed everything.** `instagramSessionId`
  returns `''` both when no cookie is configured and when the request is
  anonymous and must never carry ours; the failure branch reported both as the
  first case. Every anonymous Instagram failure — i.e. the normal case — accused
  the operator of a missing secret. That is what sent the investigation looking
  for a broken deployment instead of a restricted post.
- **I treated a credentialed session like a test fixture.** The `ig` path uses a
  real Instagram account, it deliberately bypasses both caches, and there is one
  of it. Hundreds of probe requests against it in an hour is not testing, it is
  an automation signature — and Instagram locked it. A matrix against the
  credentialed path needs a handful of requests, spaced, with the anonymous path
  carrying every case it can.
- **I spent two runs blaming Instagram for my own machine.** `fetch failed` /
  `ECONNRESET` landing on a different call each run looked exactly like
  throttling. It was undici on this box: the same URLs answered fine from
  PowerShell, and `node --dns-result-order=ipv4first` fixed it. Before concluding
  a remote host is rate-limiting you, reproduce the failure with a second client.
- **The production probe read the wrong header and I nearly filed the result.**
  It sent `Authorization: Bearer`; the Worker reads `X-Pro-Token`. Every tier
  came back identical, which reads exactly like "the grant does nothing" — a
  false alarm about a live entitlement. Verify the probe reproduces a *known*
  positive before trusting its negative.
- **Wasted a probe on a 5 ms green run.** `d.getVideoInfo is not a function` (it
  is `downloadVideo`), swallowed by a `catch` into a `console.log` that vitest
  hides unless you pass `--silent=false`. A probe that finishes instantly has
  not run.

## What worked

- **Wikipedia's "most-liked Instagram posts" / "most-viewed reels" articles** are
  a free supply of shortcodes that are public beyond dispute. `curl` the article,
  regex out `instagram\.com/(?:p|reel)/([A-Za-z0-9_-]{8,})`. This is the sample
  set I should have started from.
- **cobalt.directory `/api/tests`** — per-instance, per-service results updated
  hourly, and it flags which instances sit behind Turnstile (useless to us: they
  need a challenge token). That is how the two new instances were found.
- **Probing from a Worker on Cloudflare's network, not just the dev box.** It is
  the only way to see that both `kittycat.boo` endpoints answer 403 to datacenter
  egress while working perfectly from home. Two of the four candidates would have
  been shipped broken.
- **Comparing anonymous against credentialed on the same URL** — that is what
  separated "Instagram closed this" (fails both ways: GraphQL) from "we withhold
  the cookie here" (fails one way: restricted posts).

## Rules

- A negative result about a *platform* needs a sample you can prove is
  representative. For Instagram that means a post whose owner is public and that
  a third party resolves logged-out — not one that merely exists.
- Instagram returns the same "may be broken" shell for deleted, restricted, and
  never-existed. It carries no diagnostic information. Never conclude from it.
- When an external monitor disagrees with your measurement and its data is
  newer, your input is wrong until proven otherwise.
- A log line that names a missing secret must be true. A value that can be absent
  by policy needs its own predicate for anything that reports to a human
  (`instagramSessionConfigured`).
- Verify a third-party endpoint from the deployment's own network before adding
  it to a fallback list. Working from the dev box says nothing.
- One instance in a fallback list is not a fallback list — it is a single rate
  limit with no recovery.
- Do not write a platform-is-dead warning into user-facing copy on the strength
  of a morning's probing. The README edit was live in a commit before the
  contradicting evidence arrived.
- The credentialed path is one real account, not a fixture. Probe it in tens of
  requests, not hundreds, and prove everything you can on the anonymous path
  first. `checkpoint_required` is the bill for getting this wrong, and only a
  human with a browser can pay it.
- Reproduce a transport failure with a second HTTP client before blaming the
  remote host. `--dns-result-order=ipv4first` is the first thing to try on this
  machine.
- A probe that hits a live entitlement must first prove it can see that
  entitlement working. An all-tiers-identical result means "my probe is wrong"
  until a known-positive says otherwise.
