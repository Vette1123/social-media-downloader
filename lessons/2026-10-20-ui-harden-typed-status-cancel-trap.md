# 2026-10-20 — UI harden pass: typed status tone, focus trap, cancel, nudge damping

## What

"Perfect UI UX" pass over the one big surface (`DownloaderApp.tsx`, 3.6k lines):
1. Status message became a typed channel: `AppMessage { kind: 'info'|'success'|'saved'|'error', text }`
   in `appReducer.ts`, replacing emoji-marker sniffing (`isSuccessMessage`/`isSavedMessage` deleted).
   Banner: red = `error` only (retry offers), green = `success`/`saved`, neutral = `info`.
2. `ImageLightbox` got a TAB focus trap, initial focus on the dialog root, and focus return
   to the element that opened it.
3. Cancel button on the progress row: `AbortController` per transfer threaded into direct,
   proxied, slideshow and gallery paths; a cancel reports as `info` ("Download canceled."),
   never retries, and never falls through to the proxy fallback.
4. Attached Pro ask (`ProNudge`, post-result) now shows on the 1st save of the day, then
   every 3rd (`proSignals.attachedNudgeDue`), reusing the `recordResolve` day count.
5. break-ui flag fixes: result title `break-words`, author line got `line-clamp-2` +
   `break-words` (an 800-char author used to render ~60 lines).

Tests: 991 green (was 978). i18n's emoji-marker guard replaced by per-locale prose-existence
guard; new `proSignals.test.ts`; appReducer tests pin kind-gating for banner secrets.

## Mistakes

- I pitched "radius/spacing tokens" as a gap in the audit; measuring said otherwise —
  radii sit on the Tailwind scale with zero arbitrary values, and `Surface` is already the
  semantic token layer. The token work would have been duplicate vocabulary. Measure the
  drift before creating a system for it.
- First use of `attachedNudgeDue(0)` returned true while my own spec said 0 = quiet day;
  the test caught it before deploy. Write the spec test with the implementation, not after.
- JSX status banner rendered through `{state.message && (() => ...)}` — TS narrowed the
  outer truthiness but lost it inside the closure on `state.message`; an uninvoked IIFE also
  hid a "function as child" error until typecheck. Guard inside the IIFE instead
  (`if (!message) return null`).
- PowerShell console mangles emoji/CJK in its output; two message strings with emoji
  looked corrupted in shell output. Edit tool with Read-tool-extracted text is the only
  safe path there.

## What worked

- Reading `BatchPanel` first: it already had the abort pattern (`abortRef`,
  cancelled-excluded retry), so cancel joined an existing idiom instead of inventing one.
- The i18n tests that used to pin emoji markers turned into a *better* guard: every
  completion key must translate to distinct non-English prose per locale.
- The impeccable detector found `from-violet-500` at `platforms.ts:768` — that is
  Twitch's brand purple (#9146FF is the chip class above it), so the judgment is "keep,
  brand-governed", not "repaint".

## Rules

- A message's meaning is a field on the message, not a property of its words.
  Never re-infer state from presentation copy.
- An aria-modal dialog owes a focus trap, initial focus and focus return — all three,
  or the promise the attribute makes is not kept.
- A cancel is user intent: no retry, no fallback handoff, no red. It is success-with-
  nothing-to-show, not failure-adjacent.
- When a pitch already exists, gate it with data the pitch already collects
  (`recordResolve` day count); second ledgers drift.
- One save generating one ask is how generated UI looks. A plus must be rare enough to be
  a plus (1st save, then every 3rd).
