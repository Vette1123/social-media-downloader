# Download progress that does not move the page

## What

The progress UI was a separate block (bar, text line, Cancel) that replaced the one-line "Click to download" hint
when a transfer started and vanished when it ended. Measured on a 1.9 MB TikTok: two layout shifts (0.019, 0.013),
the block on screen for about 0.8 s, the main button dimmed to 50 %, and "Preparing your download…" printed twice
(banner and progress row).

Now:

- The button that started the transfer is the bar (`TransferButton`). The gradient fill is clipped, not scaled, so
  a dark label on the fill and a light label on the track meet exactly at the bar's edge. RTL fills from the right.
- The line under the buttons is a fixed-height slot (`TransferStatus`) with two faces in one grid cell: hint (or
  "Send to an app" after a save) and readout + Cancel. Only opacity changes.
- The readout is left-aligned with `tabular-nums`, so it no longer re-centres every 250 ms, and each segment is
  wrapped in `<bdi>` so Arabic does not reorder `1.2 MB / 8.4 MB`.
- ETA wording is localized (`etaSeconds`, `etaMinutes`); it was English on every locale.
- `SET_PROGRESS` returns the same state when the percentage has not moved. It fired once per network chunk, and
  every chunk re-rendered the whole 4,000-line downloader.
- The main Download button stacks all three of its labels in one cell, so "Download" → "Downloading..." no longer
  squeezes the input beside it.
- "Send to an app" moved out of the success banner (where it added a row and pushed the card down) into the slot.
- The sponsor card under the result stays mounted through a download instead of unmounting and remounting.
- PostHog: `fr.pinterest.com/pin/…` (any country subdomain) now detects as Pinterest, not generic.

After: 0 layout shift from start to finish on a repeat download, card height and position identical.

## Mistakes

- The first browser check clicked the Format toggle's "Video" button, not the download button, and reported
  "nothing changed". Select by structure (`.btn-grad` inside the result card), not by label text.
- My throttled-stream test made the direct path bail to the browser's own downloader through an iframe, which my
  `<a>.click()` stub did not cover, and a real `.tmp` landed in Downloads. Stub `appendChild` for iframes too.
- The PostHog subagent read 313 host-less generic failures as "plain text being pasted". They were events from
  before `host` existed (the column empties exactly on the day #34 added it). Check when a property started
  being sent before reading meaning into its absence.

## What worked

- A `PerformanceObserver({type: 'layout-shift'})` plus per-section height snapshots in the page named every shift
  source in one run, including the two that were not the progress UI (banner button, main button label).
- Red/green by writing `git show HEAD:<file>` over the one changed file, running the test, and copying the new
  version back; the working-tree guard blocks stashing the shared tree.

## Rules

- A status that comes and goes lives in a slot that is always there; swap faces with opacity, never mount/unmount.
- A label that changes inside a fixed-size control reserves the width of its longest variant.
- A reducer action dispatched per chunk or per frame returns the same state when nothing changed.
