# Honest failure codes, inert dead clicks, hero points that don't look like toggles

## What

- `failureCode` read the word "private" inside every extractor's last-resort text
  ("may be private, age-restricted, or unavailable") and filed 147 X failures from 7
  people as `private`. A new `inconclusive` code catches those guess lists first, so
  `private` means a definite answer. SoundCloud's "cannot repackage" HLS refusal is
  `unsupported` now; it had opened an Error Tracking issue.
- `isFocusDeadClick` became `isInertDeadClick`. It also drops a re-tap on a toggle
  that is already pressed (the Video/HD chips drew 16 people's dead clicks a week).
- The five hero "reassurance" pills were bordered rounded-full chips sitting under
  the real Format/Quality pills. They looked like toggles and drew dead taps. They
  are a plain check-list now, and "Any public link" is styled as the link it is.
- Placeholders lost their trailing period in all five locales. In Arabic the period
  rendered at the wrong end.
- `pnpm shots`: phone + desktop screenshots, per-screen slices, and an exit-1 check
  for anything wider than the viewport. The CDP client moved to `scripts/lib/cdp.mjs`,
  shared with `pnpm cls`.

## Mistakes

- I read "Twitter 28% failed" as a broken extractor. It was 7 people retrying the
  same few dead posts while 89 others succeeded. Split by `uniq(person_id)` before
  calling a platform broken.
- `tail -20` cut off the top row of a query, and for a while I believed Chrome
  Android paste never worked. It works for 58 people; 52 dismissed the permission
  prompt, and 89% of those who were denied pasted by hand afterwards. Count the rows.
- The first `pnpm shots` run graded Cloudflare's bot-challenge page as "fits". The
  script now refuses a challenge page and serves the local build by default.
- The first slices of the full page came back black: `.defer-render`
  (content-visibility) is not painted off screen. Slices now scroll into view.
- A Python heredoc turned `\b` into backspace bytes in a regex. Use Edit for regex.
- I nearly removed the hover lift from the static feature cards. The dead clicks on
  them were 22 phones to 6 desktops, so hover wasn't the cause; that design stays.

## What worked

- Red first: 3 failing `failureCode` cases and 1 failing dead-click case before each
  fix.
- A Sonnet reviewer read the screenshot slices so the images stayed out of the main
  context. Half its findings were deliberate (SEO FAQs, cross-promo links, Arabic
  "و" prefixing), so verify a reviewer's list before acting on it.

## Rules

- A message that lists guesses is `inconclusive`, never the first guess it names.
- A dead click on a field (focus) or on an already-pressed toggle is not frustration.
- Non-interactive reassurance copy never wears the shape of a control.
- Screenshot the build, not the live site: the WAF challenges headless Chrome.
