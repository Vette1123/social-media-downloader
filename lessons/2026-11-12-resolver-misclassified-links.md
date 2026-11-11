# Links that reached the wrong extractor

## What

PostHog (14 days, humans) showed three failure groups that were ours, not the visitor's:

- 14 `resolve_failed` events with platform `generic` and host `threads.com`, from 5 people. The Threads patterns
  only accepted `www.` and a literal `@`, so `m.threads.com` and `%40`-encoded links went to the generic resolver,
  which cannot read Threads. The Threads extractor also appended `/embed` to the raw link, so a shared
  `/post/<id>/media` view asked for `/post/<id>/media/embed`. That accounts for the 2 Threads "private" failures.
- X: a text-only post threw "No downloadable media found in tweet", the loop swallowed it, and the visitor was
  told the post "may be private". vxtwitter's HTML "Failed to scan your link" page went through the same branch.
- Short links: `b23.tv` and `share.google` hit the generic resolver as-is. `t.co` was detected as X, and the X
  extractor needs a `/status/<id>`, so every t.co link failed.

Fixes:

- Threads patterns accept any subdomain and `%40`.
- `threadsEmbedUrl` builds the embed from user and post id.
- `TWEET_HAS_NO_MEDIA` is a definite answer that maps to `unavailable`, and an HTML reply is "no answer".
- `isShortLink` expands a known shortener once through the existing `resolveRedirect`.
- `resolve_failed` now carries `shape` (`linkShape`): subdomain label, route words, and query keys only.

## Mistakes

- I first guarded the short-link hop with `platform === 'generic'`. The test went red because `t.co` is detected as
  `twitter`, so a guard on the detected platform would have left the worst case (every t.co link) broken.
- `host` alone could not say which Threads URL form was missed: `linkHost` keeps only the registrable domain. The
  fix had to be inferred from the patterns. `shape` exists so the next miss names its form.

## What worked

- Grouping failures by `host` plus `platform` separated "a site we do not support" from "a site we support,
  reached through the wrong door".

## Rules

- A share link's host is not its platform. Expand known shorteners before routing, whatever they detect as.
- An extractor that read the post and found nothing is an answer. Do not let a catch-all "may be private" outrank it.
