# The MP3 refusal offers the video in one tap

## What

- 27 Nov sweep: test 1985/1985, lint, seo:verify 95/95, PostHog 0 open, cf:health clean, CI
  10/10 green. Two open issues: #88 (YouTube MP3 96% failing) and #97 (Facebook
  `/share/v/*?mibextid`, 8 inconclusive failures from 4 people).
- #88 re-read by code: since the supporter gate (#91, 24 Nov) the only YouTube audio failures
  outside EXPECTED_CODES are 2 `upstream` on 24 Nov. The rest are `supporter` refusals, which the
  watcher already skips. #88 stays the Cobalt tracker; nothing in code is failing it.
- The same query showed one visitor refused 27 times in two days on a Short (17 on 26 Nov, 10 on
  27 Nov). Format is a stored pref plus a per-platform memory (`smd:platfmt`), so an MP3 choice
  made before the gate sends every YouTube paste into the refusal. The banner said "saving the
  video stays free" and offered nothing to press.
- Fix: `offersVideoInstead(raw)` (errorMessages) puts `videoInstead` on the banner message,
  and the banner shows "Save the video instead". It sets the global format and YouTube's
  remembered format to video, then re-runs the link with an explicit `formatOverride`, because
  the prefs it just changed haven't reached this render's closure. Translated in es/pt/id/ar.
- Verified on the dev server: MP3 + a YouTube link showed the refusal with the button, and one
  tap flipped the toggle to Video and resolved the video. Storage read `smd:format=video` and
  `smd:platfmt={"youtube":"video"}`.

## Mistakes

- Read "26 failed vs 1" in #88 as a live outage until the per-code breakdown showed the gate's
  own refusals had replaced the outage failures. Group by `code` before reading a fail rate.
- `next dev --turbopack` in a worktree with main's linked `node_modules` answered 500: Turbopack
  won't compile `next` outside its workspace root. `next dev --webpack` works there. Stopping
  the pnpm task also left the Next child holding the port, so it had to be killed by PID.

## What worked

- Grouping the platform's audio events by day and code split "outage" from "refusal by design"
  in one query.

## Rules

- A refusal that names a way out puts that way on a button.
- A re-run after a pref change passes the new value explicitly; the render closure is stale.
