# Search Console + Bing SEO pass, and the Pro auto-reply

## What

Read Search Console and Bing Webmaster for socialdownloader.space (2026-11-10, 28 days):
2.47k clicks, 22.1k impressions, 11.2% CTR, average position 5.6. 73 pages indexed, 39 not.
Bing recommendations: none.

- **Home title** now names the biggest-impression query: "Social Media Video Downloader — Save
  Any Public Video in HD" (5.1k impressions at position 4.3). The description leads with
  "Free social media video downloader". Only English moved; `pnpm i18n:lock` re-stamped the lock,
  and the localized titles are already their own keywords.
- **JSON-LD** goes through `jsonLdText` (`src/lib/structuredData.ts`), which escapes `<` so no
  string can close its own `<script>`. Pinned by a test in `structuredData.test.ts`.
- **Pro emails** to the owner's inbox get an automatic Gmail template reply with the GitHub
  Sponsors link. The filter is `subject:("Downloader supporter" OR "switch on the extras")
  -subject:re -from:me`. Reely has its own filter and template.

## Mistakes

- The first `jsonLdText` wrote `'<'`, which TypeScript reads as a literal `<`, so the
  "escape" replaced `<` with `<`. The test caught it red. The Edit tool and sed both ate the second
  backslash; only node with `String.fromCharCode(92)` wrote it.
- "Blocked by robots.txt: 11" looked like a bug. They are `/api/auth/google?redirect_to=…` URLs.
  The sign-in links are already `rel="nofollow"` and `/api/` is meant to be blocked. Nothing to fix.

## What worked

- Reading the Performance report before touching titles: the query with the impressions was
  "social media video downloader", not the brand.

## Rules

- A JSON-LD `<script>` is filled with `jsonLdText`, never a bare `JSON.stringify`.
- An auto-reply filter excludes `-subject:re -from:me`, or every follow-up in the thread gets
  the template again.
