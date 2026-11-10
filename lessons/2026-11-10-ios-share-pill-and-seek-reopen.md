# A Share pill that was not a button, and the last way to a proxy 500

## What

- **Share dead clicks (12 clicks, 5 people, plus 4 on the hint text):** the iOS Safari install card showed "Share" in a bordered, filled pill — a `<span>` with no handler. iOS has nothing to tap there (Safari's toolbar owns Share; `navigator.share()` opens a sheet without "Add to Home Screen"), so the pill is gone and the share glyph sits inline in the instruction as text. `installShare` dropped from all five locales. Checked in Chrome with an iPhone UA in Spanish and Arabic (RTL).
- **YouTube audio HTTP 500 (9 downloads, 5 people, last 11-02):** already ended by 2c21cb7 on 11-03 (refusals pass through as 4xx/502). One path still reached the catch-all 500: the seek reopen in `resolveRangeResponse` used a raw `fetch`, so a dropped connection there threw outside `fetchUpstream`. Both audio and video now reopen through `fetchUpstream` (retry once, then 502).

## Mistakes

- Took the "Share" dead click for the result card's Share button at first; the `$elements_chain` was empty, and only the i18n key search found the install card.
- Lost an iOS-UA override to a full navigation when switching locale. A synthetic `beforeinstallprompt` re-renders the component in place, and `useSyncExternalStore` re-reads the UA.
- A Python heredoc with `\b` in a non-raw string wrote a backspace into a test regex; edit regexes with Edit, not string-built scripts.

## What worked

- Same fix shape as Reely's trial badge (#170): a button-shaped span is a dead-click magnet; make it a real control or stop it looking like one.
- Matching the error's last-seen time against `git log` dates showed the 500 was already fixed before writing any code.

## Rules

- Never style non-interactive text as a pill/button.
- Every upstream fetch in a proxy goes through `fetchUpstream`; a raw `fetch` is a 500 waiting for a dropped connection.
