# Extension errors that wore our stack

## What

The error board had three open issues. Two were wallet and extension scripts
(`window.ethereum.selectedAddress = undefined`, 13 events from 4 people;
`reading 'M_ID'`, 3 events), caught by the early-crash reporter that runs before
the SDK boots. The third was Firefox refusing a codec in a `<video>` with native
controls. `isForeignEarlyError` (`src/lib/analyticsNoise.ts`) now drops an early
error whose filename or stack names files, none under `/_next/`. The media
`NotSupportedError` joined the noise list, and the lightbox video, which had no
`onError`, now tells the viewer the clip won't play here but the download works.

## Mistakes

- The existing "no frame of ours" filter looked like it covered these. It never
  could: `trackError` builds a new `Error` at our call site, so every early crash
  reaches PostHog with our chunks as its stack. The thrower is only visible in
  the `ErrorEvent`, before it is wrapped.
- The new worktree checked out CRLF (system `core.autocrlf=true`) while main is
  LF, and two source-scanning tests failed for that reason alone. Normalising the
  worktree to LF fixed it. Check line endings before reading a worktree-only
  failure as a regression.
- A Python heredoc turned `\b` and `\n` into a backspace byte and real newlines.
  Write source edits with the Edit tool or a quoted Node script.

## What worked

Grepping `src` and `out/` for `selectedAddress` and `M_ID` proved neither string
is ours before anything was filtered.

## Rules

- Decide whether an error is foreign from the original error, before it is
  wrapped; after wrapping, the stack is always ours.
- Every `<video>` gets an `onError` that tells the viewer something.
