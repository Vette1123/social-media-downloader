# Exception autocapture was off; a device fault hid behind it

## What
`pnpm posthog:issues gate` reported exception autocapture OFF at project level (327739), so the
board saw only manual `captureException` calls, not crashes. Turned on through the REST API
(`autocapture_exceptions_opt_in: true`). The board then listed `01a19180-42ad-7b00-b7ff-04439bdbba16`:
`[download:video] The requested file could not be read…` (Chrome Android, 1 person). That is
`NotReadableError`: the browser lost the blob's temp file before the save. It is the visitor's device,
not our fault. Verdict: misclassified. New `device` failure code (NotReadableError, QuotaExceededError,
disk full), added to the watcher's `EXPECTED_CODES`.

## Mistakes
- A first draft matched a bare `quota`, which would have filed a provider's "API quota exceeded" (our
  fault) as the visitor's disk. Narrowed to `QuotaExceededError` and pinned with an `upstream` row.
- The project switch had been off with nobody noticing, because an empty board looks healthy.

## What worked
- Running `gate` after resolve, not just `list`: it checks the project config as well as the issues.

## Rules
- A failure code that marks something "expected" must not match a phrase our own servers can emit.
