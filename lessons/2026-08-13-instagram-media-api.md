# The Instagram session was fine; every path that used it was dead

## What

A reel that Instagram only serves to a logged-in account failed to resolve even
for an account carrying the `ig` grant. The session, the seven companion
cookies and the grant were all in place. The cause was the GraphQL extractor:
Instagram now answers its `doc_id` (`8845758582119845`) with
`{"errors":[{"message":"execution error","severity":"CRITICAL"}],"data":null}`,
with or without a session attached. GraphQL was the only credentialed path for
posts, so a credentialed resolve had nothing the anonymous one did not: embed
returns no `shortcode_media` for the reel, GraphQL errors, Cobalt 400s.

Fixed by adding `tryInstagramMediaInfo` — the private
`/api/v1/media/<id>/info/` endpoint the logged-in web client itself calls,
keyed on the numeric media id that the shortcode encodes (base64 over the URL
alphabet, so `instagramMediaId` replaces a lookup request with arithmetic). It
returns `video_versions` for the target reel and its response is translated
into the existing `shortcode_media` shape, so carousels, captions and the
poster-is-not-a-photo rule stay in `parseInstagramMedia` alone.

## Mistakes

- Reached for the deployment before the request. The first instinct was that
  the session had expired or the secrets were missing — neither was true (all
  eight `IG_*` secrets are uploaded, two user rows carry `ig`). Probing the
  three endpoints directly is what found the dead one, and that should have
  been step one.
- Nearly read `web_profile_info` returning **429** as the failure. It is a real
  problem — the story extractor resolves usernames through it — but it is not
  this one: the media API answered 200 on the same session seconds later. A
  session is not proven dead by one rate-limited endpoint.
- The extractor's own failure message ("the configured session may have
  expired") pointed at the wrong thing for weeks. A message that names the most
  likely cause is only useful while that cause is still the likely one.
- `0n` literals typechecked locally and failed `tsc` — tsconfig targets ES2017
  for the old-phone audience. `BigInt(0)` compiles; the ids are server-side
  only, so nothing ships to a phone either way.

## What worked

- Probing each endpoint in a scratch vitest file with the real cookies loaded
  from `.env.cloudflare`: status, byte count, and whether `video_versions` was
  present. The byte count is what showed the anonymous call is not merely
  refused but answers 200 with a ~600 KB login wall — which is why the new
  extractor returns null before making a request without a session.
- Translating the media-API item into the existing `shortcode_media` shape
  rather than writing a second parser. The adapter is ten lines; a parallel
  parser would have been a second place for the carousel rules to drift.
- Reading `wrangler secret list` and a `count(*)` over `users` to rule out
  configuration without printing a single secret or address.

## Rules

- Before blaming a credential, prove it: call one endpoint that only a valid
  session can answer. A 429 elsewhere proves nothing.
- Any Instagram path keyed on a `doc_id` is a rented one. When it breaks it
  breaks silently with a 200, so treat "extractor returns null" as suspicious
  rather than as absence of media.
- An endpoint that answers 200 with a login wall is worse than one that 401s —
  check the shape of the body, never just the status.
- New extractor, new runnable check: `downloaderCredentials.test.ts` asserts the
  gate makes no request without a session, and that a refused session degrades
  to null instead of throwing.
