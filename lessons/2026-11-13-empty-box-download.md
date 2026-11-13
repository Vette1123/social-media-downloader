# The main Download button downloads the result on screen

## What

PostHog: after d63faac fixed the empty-box dead clicks on a fresh page, every remaining rage cluster on the
main Download button (11-10 at 1536 px, 11-11 twice at 526 px) was a press with an EMPTY box and a RESULT ON
SCREEN. The box clears itself after a resolve, so the biggest button on the page said "Download" and answered
"Paste a link first".

Now `emptyBoxDownload(state)` (`src/lib/appReducer.ts`) decides: with a result and an empty box, the main button
scrolls the card into view and starts its video download (audio when the result is audio-only, nothing for
galleries, which keep the old message). It only applies to a typed submit (`overrideUrl === undefined`) and
never while a resolve or download is running. Tracked as `empty_box_download`.

## Mistakes

- `handleProcess` is declared ~600 lines above `handleVideoDownload`/`handleAudioDownload`. Calling them
  directly passed tests and the build but failed `react-hooks/immutability` lint ("accessed before it is
  declared"). Fixed with a `startDownloadRef` assigned in an effect below the handlers. Run lint before the
  browser check, not after.
- My browser script picked the main button by `[type="submit"]`. It has no `type` attribute, so the DOM
  reports "submit" but the selector matches nothing. Select by class/structure.

## What worked

- Reading the rage clicks' surrounding events (input value, result present) instead of the click counts. The
  count said "Download is broken"; the sequence said "Download means something else to them here".

## Rules

- When a control's input clears after success, define what the control does with the empty input in that state.
- A forward call between large handlers in one component goes through a ref set in an effect.
