# Result card: the download button in the first screen

## What

On a 390×844 phone, after the auto-scroll to a result, the order was success banner → header → "Hide preview" →
a 350 px video → Video button. The main action sat about 1,100 px down, below the fold. Now:

- Card order is header → quality picker → Video / Extract Audio → status line → iOS hint → preview → gallery →
  extras. The Video button lands at y≈283 in the first viewport.
- With a result on screen, the banner above the card shows failures only. A resolve is confirmed by the card
  itself; a save or cancel shows in the fixed status line under the buttons ("✓ Saved" + "Send to an app"), via
  `transferNote`. A hidden live region still announces every message to screen readers.
- The support nudge moved from above the card to below it, and is keyed to "a result is on screen" instead of to
  the "processed" message, so a save no longer unmounts it.
- Idle hint: "Click to download your content" → "Saves straight to your device" (5 locales). "Click" was wrong on
  a phone and the line said nothing.
- Extras (thumbnail / share / copy) are a two-column grid on phones, with an odd last item spanning the row. Pills
  wrapped two-plus-one, and "Copy link" → "Copied" reflowed the row.
- Status faces fill the slot's height (the grid cell reported a 5 px shift when the face changed), and the busy
  button label reserves its widest form so the percentage doesn't re-centre it.
- Arabic at 360 px: the "Get it as" row wraps as a whole; before, the label and "Data saver" each broke in two.

## Mistakes

- The first slot note used the banner's full sentence ("Video downloaded successfully! 🎉"). It truncated beside
  "Send to an app" at 390 px in English and at 360 px in Arabic. A one-word "Saved" plus the check mark says the same.
- Moving the nudge below the card while it was still gated on `kind === 'success'` would have unmounted it on every
  save and moved the sponsor cards under it. A component moved to a new place keeps its old mount condition; check
  that the condition still fits.

## What worked

- Reading the button's `getBoundingClientRect().top` after the auto-scroll gave a single pass/fail number for
  "is the action in the first screen".
- Testing in Arabic at 360 px found the two problems that English at 390 px hid.

## Rules

- On a result, the action comes before the preview. The preview is optional; the button is the reason for the page.
- Feedback about an action appears at the control that caused it, in a slot that is always there; a banner above
  the content is for failures.
- Text in a fixed-height slot is written for the slot: the short form, checked at 360 px in the longest locale.
