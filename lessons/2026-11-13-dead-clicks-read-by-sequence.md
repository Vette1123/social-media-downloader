# Dead and rage clicks, read by what happened around them

## What

Turn-1 PostHog counts named five "broken" controls. Read with the surrounding session events, each had a
different cause:

| Control | Count | What it actually was | Fix |
|---|---|---|---|
| Gallery save "rage clicks" | 85 of 89 | `saveBlob()`'s own programmatic `<a download>` clicks; three saves in ~1 s look like rage | `ph-no-capture` on that link |
| HD / Video / Audio chips | 53 of 53 | Taps on the ALREADY-selected chip, mostly right after a failed resolve | `chipRetryLink`: that tap retries when a failure is on screen |
| Paste | 16 | 9 clipboard-denied, 5 reads still pending (iOS "Paste" bubble, 2.4–7.8 s) | Spinner + `aria-busy` while the read is pending, same chip width |
| Share | 14 | iOS install hint pill; already fixed by bebf5d4 (0 since 11-08) | none |

Also on the gallery path: the per-file save loop waited 500 ms after the LAST file too (every single-image save
held "Saved" back by half a second), never reported progress, ignored Cancel on its first request, and its
failure text was English-only. `imageSaveStep` now pauses only between files and moves the button's bar.

PRODUCT.md written (impeccable init): mobile one-off saver; binding claims are "free, no login, no limits" and
"no popups, redirects or ads".

## Mistakes

- I planned the Safari fix as "the button gives no feedback for 1.1 s" from the click-to-`download_started`
  delta. The clicks were not people at all. Check what element a rage click is on before reading its timing.
- I nearly built a Share fix that shipped three days earlier. Split dead-click counts by day against the
  deploy date of the last fix before planning one.

## What worked

- One subagent joining each click to the ±10–15 s of the same session, plus the element chain
  (`attr__aria-pressed="true"`, `attr__download=`), turned counts into causes.

## Rules

- A synthetic click the code fires itself carries `ph-no-capture`.
- A selected toggle tapped again needs a meaning when the page is in a failed state.
- Any control that awaits a system prompt shows its pending state at once.
