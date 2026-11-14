# Honest error banner, tappable feature cards, per-page share image

## What
- The error banner tells people when a retry cannot help. Each failure carries
  `retry: yes | once | no`, a per-link failure streak counts repeats, and from
  the second identical failure the banner says so and drops "Try again".
  Guess-list errors ("may be private…") get their own "We couldn't download
  this one" banner instead of being read as the first guess.
- The home feature cards were static tiles that lifted on hover; 19 phone users
  tapped them for nothing. They are now buttons: they set the format (only MP3
  picks audio) and focus the paste bar.
- JSON-LD `primaryImageOfPage` names each page's own OG image, not the home one.
  Two titles over 60 characters were shortened.

## Mistakes
- Held the failure streak in a `useRef`. The React compiler lint (`react-hooks/refs`)
  failed `pnpm verify`, because `reResolve` reads it and a render-time IIFE
  captures `reResolve`. Fixed by moving it into a tested `createFailureStreak()` held by
  `useState(createFailureStreak)`.
- Put `id` before `dir='auto'` on the paste input; a source-shape test in
  localeRoutes.test.ts pins `<input dir='auto' ref={inputRef}`. Run the
  whole suite before assuming an attribute order is free.
- Turned the cards into `<button>` with `<p>` inside, which is invalid HTML (buttons
  hold phrasing content only). Changed to block `<span>`s.
- A Node `-e` replace ate the backslash in `/\/$/`; regex edits go through Edit.
- Skipped the audit's "No Watermark" TikTok title: the page's FAQ deliberately
  doesn't claim watermark removal, so the title would contradict it.

## What worked
- `pnpm i18n:lock` names stale sentences as well as missing ones; the old
  rate-limit hint was the only failure after translating.
- Checking the built `out/` HTML for `og:image` showed every route already had
  its own image, so the fix was one line in `webPageNode`.

## Rules
- Mutable per-component counters that handlers read: a `useState` initialiser
  returning a small object, not a ref, when render closures can reach them.
- A card that lifts on hover must do something on tap, or not lift.
- Never put a claim in a title that the page's own FAQ disowns.
