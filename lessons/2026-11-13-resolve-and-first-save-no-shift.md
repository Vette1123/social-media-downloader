# Resolve and first save without moving the result

## What

An end-to-end pass (paste → resolve → result → save → next link) at 390×844 with a layout-shift observer found
two shifts the progress fix had not touched:

- **Every resolve, for anyone with history: 0.018.** Recent unmounted while a resolve was in flight
  (`!state.loading`) and remounted above the finished result, pushing it down 94 px. It now stays mounted and is
  `inert` + dimmed while loading, which keeps its "can't re-tap mid-request" purpose.
- **First-ever save.** The first save adds the first Recent row, and the list appeared above the card. Its first
  appearance now waits for a calm moment (`mayRevealRecent`): no result on screen, or the visitor typing the next
  link. Once shown it latches.
- **Save completion: 0.0027.** The "Saved just now" pill appeared in the result header the moment a save finished,
  growing a vertically centred column. The pill is meant for "you already have this one", so it now shows only for
  a save made before the result was opened (`savedBeforeOpening`).

After: resolve 0, save 0 (card top 737 → 737), Recent appears on typing, re-opening a saved link shows the pill.

Not fixed: arriving through `/?url=` (share sheet) shows the result skeleton under the input and pushes the hero
chips below the fold (0.134). The page is static, so the space cannot be reserved before the client reads the URL.

## Mistakes

- The previous lesson declared the flow shift-free from a run that started with a result already on screen. The
  resolve itself was never measured; a returning visitor hit 0.018 on every link.
- The first reading of the 0.134 entry was "the hero blocks vanish". `currentRect` y=0 means the element left the
  viewport, not the DOM. It was content inserted above them.

## What worked

- Running the journey twice, with history and with history removed: each run surfaced a different shift.
- Reading `previousRect → currentRect` per source and summing the heights of siblings above (79 + 16 = 95 ≈ 94.5)
  named the element without guessing.

## Rules

- Measure from the visitor's starting state, not from mid-flow: start with and without stored data.
- A list that hides during a request goes `inert`; it does not unmount.
- Status that is a consequence of the current action belongs in the banner; the card only notes facts that predate it.
