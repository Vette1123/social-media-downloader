# YouTube MP3 is a supporter feature

## What

YouTube now keeps its audio behind a login, and MP3 failed 38 times in 47 this week (#88).
The owner made it a supporter feature instead of letting everyone wait for a failure.

- `src/lib/supporterOnly.ts`: `supporterOnlyReason` refuses an audio-mode YouTube resolve
  without a supporter token (403, before the cache). `bodyForCaller` takes `audioUrl`,
  `metadata.rawMusicUrl` and `metadata.directAudioUrl` out of a YouTube result sent to a free
  visitor. The cached copy stays whole, because both cache tiers are shared.
- New failure code `supporter`: expected, never an Error Tracking issue, and in the watcher's
  `EXPECTED_CODES` so refused free visitors don't reopen YouTube issues.
- Banner: "MP3 from YouTube is for supporters", with no retry. Translated in 4 locales.
- Copy: the home FAQ, the web-app feature list, and the YouTube page's MP3 card and FAQ now say
  MP3 from YouTube is for supporters. The YouTube page title and H1 are left alone for the
  2026-12-01 re-check. MP3 is still offered there, to supporters.

## Mistakes

- The first gate refused audio-mode resolves only. A YouTube *video* resolve also carries
  the audio track, and the card's MP3 button saves from it directly, so MP3 stayed one tap
  away. That was caught by reading the button's path before shipping. Gate the data, not
  the request that usually asks for it.
- A refusal message with no rule in `analyticsErrors` falls through to `upstream`, an
  Error Tracking issue. Every new server message needs a code.
- `next dev --turbopack` in a git worktree with a linked `node_modules` fails ("Could not
  find the Next.js package"), because the link sits outside Turbopack's root. Use `--webpack`
  for a worktree dev check.

## What worked

- One helper module, applied at the three return points of `handleDownload` (Map hit, edge
  hit, fresh), so no caller can miss it.

## Rules

- A paid gate removes the data from the response, not just the request mode.
- Supporter resolves still use the public resolvers, so supporters fail the same way until
  `COBALT_API_URL` points at a Cobalt with a YouTube session (ponytail note in
  `supporterOnly.ts`). Don't list YouTube MP3 as a `/pro` benefit until that exists.
