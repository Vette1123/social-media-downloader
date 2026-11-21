# The X chain ended on one host

## What

PostHog issue #68: 47 of 254 X resolves failed in 3 days, mostly `x.com/<user>/status/<id>` with the last-resort "may be private" message. The chain was vxtwitter, then Cobalt. When vxtwitter answered with its HTML "Failed to scan your link" page (it does that for rate limits and blocked edges as well as for dead posts), Cobalt was the only thing left. Added FxTwitter (`api.fxtwitter.com`) as a second API between them; it reads the same post from a different service.

## Mistakes

Reported links are hashed in PostHog, so the failing posts could not be replayed. From a home connection vxtwitter and FxTwitter both resolve every public post I tried (photo, text, `/i/`, wrong username, `/video/1`), so the production-edge failure is not reproducible locally. The fix is therefore a redundancy fix, not a proven single-cause fix. A fake tweet id looks exactly like a blocked API (same HTML page): use a real id before concluding anything.

## What worked

A test where vxtwitter returns the HTML page and FxTwitter returns a video: red on the old chain ("may be private"), green with the new method. FxTwitter's `media.all` schema was checked live against a real post.

## Rules

- A resolver chain needs two independent API hosts before the generic fallback, not one.
- Check production after deploy: if "inconclusive" for X stays high, the next suspect is Worker-IP blocking of both hosts.
