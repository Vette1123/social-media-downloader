# YouTube audio 403, a dead slideshow button, and early-error noise

## What
Cleared the week's PostHog errors: YouTube audio `HTTP 403` (34 events), a slideshow button that can only 501 on Cloudflare (23), early-crash noise ("Script error.", wallet, M_ID), and a LinkedIn refusal filed as an exception.

## Mistakes
- The 403 looked like an expiring URL or a missing Referer in the proxy. It was neither: Innertube IOS audio URLs serve the first ~1 MB and 403 every later range (they want a PO token). Two earlier comments called these URLs "verified end to end" off a 206 on the first bytes.
- The early-crash filter keyed on filename and stack, so a cross-origin "Script error." (a bare string, no file, no Error) sailed through even after the last round.
- Dead-click chips (HD, Video, Download) were chased without a repro: tapping an already-selected chip, or a download handed to the browser, changes nothing on the page by design. Left alone.

## What worked
- Minting a real URL from the dev machine and probing ranges (0-99999 ok, 1000000+ 403) found the cause in minutes.
- A one-range probe at resolve time stops offering audio that can only fail on Save.

## Rules
- "Verified" for a media URL means a read past the first megabyte, not the first bytes.
- Early-error filters must also match on the message; a cross-origin error has nothing else.
- Do not offer a control the deployment cannot honour (`slideshowRenderOffered`).
- A refusal phrased "signed-in"/"logged-in" is `private`, expected, event only.
