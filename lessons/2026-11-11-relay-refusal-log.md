# The relay's refusals say where they were sent

## What

After the Instagram page relay shipped, the first live smoke failed with a
Worker log line that read only "the page relay answered 302". Instagram had
login-walled the Deno address for a few minutes after a probe burst, but the
line could not tell that apart from a broken relay. The relay already sends
`x-upstream-location` and `x-deno-region`; `getCrawlerPage` now reads both, and
the warning reads `answered 302 for <code> → https://www.instagram.com/accounts/login/… (region ams)`.

## Mistakes

- **Per-page alt on the `[lang]` share cards was built, then thrown away.**
  Next takes a dynamic alt from an image route only through
  `generateImageMetadata`. Under `output: 'export'` it generates the route's
  `generateStaticParams` from it, calls that with `{}` instead of each
  parent `lang`/`slug`, and the export fails with "returned an empty array". The
  route's own `generateStaticParams` can't coexist with it ("Duplicate
  export"). The only way out is moving the cards out of the file convention,
  which changes every share-image URL for a field few clients show. Not done.
- Two local builds were wasted in the worktree: Turbopack will not resolve a
  `node_modules` junction outside its root (`turbopack.root` did not help),
  and webpack's route typing fails on the icon routes. A scratch clone with
  `pnpm install --prefer-offline` (~55 s) builds like CI does.
- The Arabic FAQ review nearly "fixed" `ألصق` to `الصق`. Both are correct
  (Form IV `أَلْصِقْ` and Form I `الْصَقْ`); `ألصق` is used 53 times, including
  the hash-pinned share-card copy.

## What worked

- A failing test first: the relay answering 302 with the two headers, asserting
  the log line carries the login path and the region.

## Rules

- A log line about a refusal names where the refusal pointed.
- Build a Next change that needs a real export in a scratch clone, not in a
  worktree whose `node_modules` is a junction.
