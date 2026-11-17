# Paste and Download INP: the re-render hypothesis did not hold

## What
Field mobile INP on `/`: Paste chip p75 1016 ms (processing 1011, n=5), 59 more reports with no target (likely the same tap, the chip unmounts), Download p75 256 ms (presentation 189, processing 49). Added `pnpm inp:flow` (scripts/inp-flow.mjs): phone viewport, 4x CPU throttle, clipboard permission granted, Event Timing per tap, median of N runs, gate on median processing (`--max`, default 150), `--trace` prints CPU-profile self time, `--settle` taps earlier.

Follow-up the same day: PostHog's INP attribution was read for the worst taps
and carries no script names (posthog-js drops the long-animation-frame
entries), and the slowest one (2,000 ms) had 1,996 ms in handlers and 4 ms of
paint. `lib/slowInteractions` now sends `slow_interaction` (area health, at
most 3 per page) for any tap of 500 ms or more: the element (named at
pointerdown, so a chip that unmounts is still named), seconds since load,
whether the page went hidden during it, and the top three long-animation-frame
scripts reduced to file names. Checked in real Chrome: a 700 ms click handler
reported `BUTTON#slow.onclick 700ms`, and a button that removes itself was
still named. Read it with
`SELECT properties.target, properties.hidden, properties.top_scripts, properties.since_load_s FROM events WHERE event='slow_interaction'`.

## Mistakes
Went in expecting `setPasting(true)` / the reducer dispatch to re-render the whole DownloaderApp inside the click. Measured, it does not: Paste processing 12 ms, Download 27 ms median at 4x, also when tapped 300 ms after load (before hydration settles). The CPU profile of the tap window was idle plus native "(program)"; no React function showed more than ~16 ms. So no app change was made; a speculative startTransition/memo would have been a fix with no red test.
- The reporter's first version kept the first entry of a tap (`pointerup`,
  0 ms of handlers) because a tap's entries share one duration; the `click`
  holding the 700 ms was dropped. Ties now break on handler time.

## What worked
Splitting a tap into processing vs presentation before touching code. Lab Download presentation is ~95 ms with no GPU, field 189 ms: the Download tap is paint-bound, not handler-bound. The Paste field figure (1011 ms processing) cannot be reproduced with the permission already granted; the remaining suspects are real-device only: the Android clipboard permission bubble / browser IPC around `navigator.clipboard.readText`, and the first tap racing hydration. Next evidence needed is field attribution (long-animation-frame scripts) on those taps, not another lab guess.

## Rules
- Reproduce the field number in the lab before choosing a fix; if the lab is 80x smaller, the cause is not the one you can simulate.
- Gate on processing, not presentation, on a GPU-less box.
- Keep the measurement script even when it clears the hypothesis: it is the guard against the hypothesis becoming true later.
