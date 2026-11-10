# SEO finish: one sign-in URL, og:locale:alternate, an /account description

## What

- Sign-in anchors render one constant `href="/api/auth/google"`; `redirect_to` is added in `onClick`/`onAuxClick`, which run before the browser reads `href`. Google had queued one `?redirect_to=` URL per page (11 "Blocked by robots.txt") despite `rel=nofollow`.
- Every localized page's Open Graph block names the other four languages as `og:locale:alternate`.
- `/account` (all locales) gets its own description from the already-translated `intro`, through one `accountMetadata(locale)`. Before, it inherited the homepage's downloader pitch.
- `?ref=share` was dropped: no surface shares a site URL. The result card shares the original post, and "Send to an app" shares the file.

## Mistakes

- The plan carried `?ref=share` as an item without checking what the share buttons send. Read the share code before planning attribution for it.
- The first edit script failed on CRLF files. Normalize to LF to match, then write back with the file's own line endings.
- `pnpm dev` in a worktree fails ("Could not find the Next.js package") because `node_modules` is linked and Turbopack refuses files outside its root. Reely fixed this with `turbopack.root`; here, verify on production instead.

## What worked

- Red/green by copying one file's `origin/main` version over it (`git show origin/main:path`), running the test, and copying the new one back.

## Rules

- `nofollow` is a hint. A URL you don't want crawled must not appear in the HTML at all; build it at click time.
