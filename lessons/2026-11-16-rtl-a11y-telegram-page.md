# RTL pass, focus and contrast floor, Telegram landing page

## What
- Arabic layout: logical classes (`ps/pe/start/end/text-start`) on the Recent
  list delete X, gallery badges, install prompt, Pro nudge dismiss, account and
  home chips, FAQ triggers, AccountPanel facts.
- Lightbox follows reading order in Arabic: next sits on the left, chevrons
  mirror, ArrowLeft/swipe-right mean next, the slide travels mirrored. One pure
  rule in `src/lib/lightboxDirection.ts`, tested. Framer wrapped in
  `MotionConfig reducedMotion='user'`.
- Global `:focus-visible` ring and cyan `::selection` in `@layer base`, so any
  component's own ring (utilities layer) still wins. Language picker had
  `outline-none` and no ring.
- The result card takes focus after resolving (`tabIndex=-1`, `outline-none`).
- Apps menu was `role=menu` with no arrow-key model; now a disclosure
  (`aria-controls`), Escape returns focus, tabbing out closes it.
- Small text under white/50 raised to 55-60 (6 places).
- WebApplication `featureList` names every platform page, generated from
  `platforms` (it listed 5 of 14).
- New `/telegram-downloader` page in 5 locales; sitemap 90 -> 95 URLs.

## Mistakes
- Took the audit's "paste bar is not RTL-aware" at face value and converted it
  to `pe-`/`end-`. The 320px Arabic screenshot showed the Paste chip covering
  the placeholder: an empty `dir='auto'` input computes LTR, so the input's
  `pe-` resolved right while the chip's `end-` followed the RTL container left.
  The original physical classes were coherent. Reverted with a comment.
- Deleted a subagent's scratch dir at the drive root; the dangerous-rm prompt
  interrupted the user. Subagent scratch now goes under the job tmp dir.
- Stashing for a red/green check is blocked here (shared tree); copy the one
  file aside, write HEAD's version over it, run, copy back.

- Confirmed "the bot FAQ is live" by grepping the live page for the bot's
  handle, but the footer already links it; the deploy was still queued. Grep
  for a phrase only the new copy contains ("without leaving Telegram").
- A string replace across locale files hit the same sentence on other
  platforms (shared FAQ wording). Edit the JSON by path instead: load, change
  the one field, write back with 2-space indent + CRLF (byte-identical
  round-trip, checked first).
- `release-notes.test.mjs` timed out twice (7-9 s vs the 5 s default) from
  git spawns under the full parallel run; the file now sets 30 s.

## What worked
- `pnpm shots --routes /ar,...` after the build caught the regression an audit
  and typecheck could not.
- Rejected two audit items on reasoning: per-locale WebSite JSON-LD would give
  one `@id` conflicting descriptions; footer platform links duplicate the grid
  every page already has.

## Rules
- A `dir='auto'` field's padding and the controls overlaid on it use the
  FIELD's direction, not the page's. Logical classes on the overlay resolve
  against the container; check both in an Arabic screenshot.
- An audit finding is a hypothesis: screenshot the locale it claims is broken
  before and after.
