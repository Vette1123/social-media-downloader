# Instagram closed the logged-out door — and our log said the opposite

Follows [2026-08-13 — the Instagram session was fine; every path that used it
was dead](2026-08-13-instagram-media-api.md), which moved the credentialed path
onto the media API. This is the other half: what is left for everyone else.

## What

Production logs showed Instagram downloads failing for real users, with the
line `Instagram extraction failed and IG_SESSIONID is not set`. The secret *was*
set. This session established what is actually broken, made the log tell the
truth, and deleted an extractor that can no longer succeed.

Probed from two vantage points (a residential IP and a throwaway Worker running
on Cloudflare's network via `wrangler dev --remote`), against a post proven live
because the credentialed path resolved it the same hour:

| Surface | Logged out | With `IG_SESSIONID` |
| --- | --- | --- |
| Embed page `/p/<sc>/embed/captioned/` | 200, `contextJSON: null`, renders "The link to this photo or video may be broken" | same |
| Web GraphQL, `doc_id=8845758582119845` | `{"errors":[{"message":"execution error","severity":"CRITICAL"}],"data":null}` | **identical** |
| Web GraphQL, `doc_id` harvested from Instagram's own bundle that day (`PolarisPostRootQuery_instagramRelayOperation = 28067070969622724`) | same `execution error` | — |
| `/p/<sc>/?__a=1&__d=dis` | 404 | 404 |
| `/api/v1/media/<id>/info/` | 200 with a ~600 KB login wall, not JSON | **works** — real `fbcdn` URL |
| Public Cobalt (`co.otomir23.me`) | 400 `error.api.fetch.empty` | n/a |

So: one working path, and it is the one deliberately reserved for accounts
carrying the `ig` grant. Instagram is broken for every public visitor, and no
code change in this repo can unbreak it.

## Mistakes

- **The log line lied, and I believed the report built on it.** `instagramSessionId`
  returns `''` for two unrelated reasons — nobody configured a cookie, and *this
  request is anonymous so it must never carry ours* — and the failure branch
  printed "IG_SESSIONID is not set" for both. Every anonymous Instagram failure,
  i.e. all of them, printed a message accusing the operator of a missing secret.
  A getter that folds a policy decision into an absence needs a separate
  predicate for anything that reports to a human.
- **Nearly "fixed" it by opening the cookie to everyone.** The obvious reading of
  "IG_SESSIONID is not set, check and fix" is *use the env var*. The env var is
  set and valid; it is gated on purpose. Attaching it to anonymous resolves is
  the "we send our credentials on your behalf, for the entire internet" posture
  the `ig` grant exists to prevent — a policy reversal, not a bug fix, and not
  mine to make silently.
- **Wasted a round on dead sample URLs.** The first shortcode I probed was one I
  invented and the second was from a test fixture; both returned the same "post
  may have been removed" shell as a live post does, so nothing was learnable
  until a post was proven live by resolving it credentialed first. Prove the
  sample before trusting the negative.
- **Assumed a retired `doc_id` was the whole story.** It was worth 15 minutes to
  harvest a fresh one from Instagram's JS bundles (grep `Polaris\w*Query` +
  15-digit id in the `rsrc.php` scripts). It works — and is refused for a
  logged-out caller exactly like the old one. Worth knowing that re-pointing the
  extractor is not the fix, rather than assuming either way.
- **The first probe ran in 5 ms and "passed".** `d.getVideoInfo is not a function`
  — the method is `downloadVideo` — and the `catch` swallowed it into a log line
  that vitest hides without `--silent=false`. A green probe that finished
  instantly is a failed probe.

## What worked

- **Two vantage points settle "is it us or them" in one step.** Residential and
  Cloudflare-edge fetches returning the same empty embed ruled out an IP block
  immediately. `wrangler dev --remote` pointed at a 30-line throwaway Worker is
  the cheapest way to ask "what does *our host* see".
- **A scratch `*.test.ts` in `src/lib/` as the probe harness.** It reuses the real
  `Downloader`, the real vitest resolver and the `@` alias, so it exercises
  shipping code rather than a re-implementation. Deleted afterwards.
- **Comparing anonymous against credentialed on the same URL.** That is what
  separated "Instagram closed this surface" (fails both ways — GraphQL) from
  "we withhold the cookie here" (fails one way — media API).
- **Deleting the GraphQL extractor rather than repairing it.** It cost a homepage
  GET plus a POST on every Instagram resolve to return `null`. The server refuses
  the *query id*, independent of post and of session, so there was nothing to
  repair.

## Rules

- A log line that names a missing secret must be true. If a value can be absent
  by policy, give the reporter its own predicate (`instagramSessionConfigured`)
  and say which case it is.
- Prove the sample is live before drawing conclusions from a failure. Instagram
  serves the same shell for "removed", "never existed" and "not for you".
- When an upstream fails, test the same URL anonymously *and* credentialed. The
  difference is the diagnosis.
- Confirm from the deployment's own network, not just the dev box, before
  blaming an IP block — and confirm from the dev box before blaming Cloudflare.
- An extractor whose upstream refuses its request identically in every
  configuration is not a fallback; delete it and record why, with the exact
  error string, so nobody re-adds it from a blog post.
- Opening a credential's blast radius is a product decision. Diagnose it, present
  it, do not ship it.

## Still open

Instagram cannot work for public visitors from this deployment without sending
someone's session cookie. The options are: leave it honestly broken (shipped —
the error now says Instagram requires a login and that it is not the user's
link), self-host a Cobalt instance holding its own burner session (same
credential exposure, one layer further away), or drop the `ig` gate (rejected
here — it is the acceptable-use clause that ended the store). Revisit if
Instagram reopens a logged-out surface.
