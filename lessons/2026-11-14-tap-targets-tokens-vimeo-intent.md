# Tap targets, template tokens, Vimeo-to-MP4 and Spanish Reels intent

## What
- Phone tap targets: Format/Quality/"Get it as" pills and the Paste chip grew on
  phones only (desktop unchanged); their row labels went from white/50 to /65.
  History meta text from 10px white/50 to 11px white/60.
- Feature cards: content pinned to the top (`flex flex-col items-start h-full`).
- Pro "File names your way" copy renders `{date}`-style tokens as LTR code chips
  (`splitTemplateTokens` + `TemplateText`, used by InfoPages and SupportPanel).
- SEO from Search Console: /vimeo-downloader targets "vimeo to mp4" / "vimeo link
  to mp4" (title, H1, description, intro, a new first FAQ, in 5 languages);
  /es/facebook-downloader leads with "descargar reels de Facebook … online".

## Mistakes
- Turning the feature cards into `<button>` earlier today vertically centred their
  content, because browsers centre a button's children. Two columns with different
  copy lengths stopped lining up. The screenshot pass after that change was for
  overflow only, so it missed this; a fresh UX critique of the screenshots caught it.
- Calling the 24 Nov Search Console re-check a scheduled cloud routine: a cloud run can't
  open the owner's Chrome, the only place GSC is readable, so it became a paste-in prompt.

## What worked
- A read-only critic subagent over existing screenshots, in parallel with an SEO
  editor confined to copy files: no conflicts, one combined verify.
- Making the SEO agent cite file:line for every new claim (Vimeo progressive MP4
  at downloader.ts:1896-1950) kept the copy honest.

## Rules
- Swapping a div for a `<button>` needs explicit `flex flex-col items-start`; check alignment, not just overflow.
- Template syntax shown to users is code, rendered LTR, never raw braces in prose.
