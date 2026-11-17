# Headings strand their last word on a phone

## What
`pnpm shots` on `/`, `/tiktok-downloader`, `/ar` and `/pro`, phone and desktop:
no sideways overflow anywhere, RTL arrows and bidi platform lists right in
Arabic. One visible defect: the `/pro` heading wrapped "Free forever. Not free
to / run." on a 390 px phone, leaving "run." alone, and the intro under it left
"them." alone.

- The three `InfoPages` headings shared one hand-copied class string; they now
  share `PAGE_H1` with `text-balance`, and the 404 heading balances too. The
  `/pro` heading reads "Free forever." / "Not free to run.".
- The intro paragraphs share `PAGE_INTRO` with `text-pretty`: it keeps the full
  line length and only refuses an orphan.
- `src/lib/headingBalance.test.ts` fails for any `<h1>` under `src` that does
  not balance (it named all four before the fix).

## Mistakes
- The first `pnpm shots` run in Git Bash died with "Cannot navigate to invalid
  URL": the shell rewrote `/,/pro` into Windows paths. `MSYS_NO_PATHCONV=1`
  is needed for any `--routes` argument.
- Nearly "fixed" the home hero's single chip ("HD quality"), which looked thin
  next to the TikTok page's four. `homeHeroChips` documents why it is one: the
  line above the paste bar already says the other three. Read the helper's
  comment before calling a sparse row a bug.

## What worked
- A source scan test over every `<h1>` catches the siblings a one-page fix
  would have left (the 404 heading was never reported).

## Rules
- Headings use `text-balance`, paragraphs `text-pretty`.
- A class string repeated on three headings becomes one constant.
