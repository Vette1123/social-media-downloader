# Template URLs, nofollow sign-in, 301 slashes, early-error holes

## What

- **Error board:** two issues reopened after the 2026-11-06 fix, three events from one person on Chrome iOS. `[early_crash] The object can not be found here.` slipped through because the noise rule demanded a `NotFoundError: ` prefix, which the early reporter never sends. `[early_rejection] Error: Na` was an Error built in another JS realm: it fails `instanceof Error`, so `isForeignEarlyError` never read its stack and `String()` gave "Error: Na". It is now dropped as foreign. Also fixed: the `namesAFile` regex said `.jsb`, meaning `\.js\b`.
- **Search Console:** "Alternative page with proper canonical tag" listed `/?url={search_term_string}` and `/?url={url}`. These were the JSON-LD SearchAction and UseAction templates, crawled as literal URLs. Both were removed; the sitelinks search box has been gone since 2024.
- **Search Console:** the 11 "Blocked by robots.txt" URLs were `/api/auth/google?redirect_to=<page>`, one per page the sign-in button sits on. Both sign-in anchors now share `signInLink()`, which carries `rel="nofollow"`.
- **Slashes:** a trailing slash got Cloudflare's default 307, a temporary redirect. `public/_redirects` now 301s it, with one placeholder rule per path depth. This was verified under `wrangler dev`, and query strings carry over.

## Mistakes

- The 11-03 ledger entry claimed this issue was fixed, and it reopened twice. Each fix matched the message PostHog showed, not the message the early reporter actually sends. Test with the `[early_*]`-prefixed string.
- The worktree checked out CRLF again, and two suites failed only for that. The guard blocks a hard re-checkout, so I stripped CR with `sed` on the tracked text files instead. Afterwards, `git -c core.autocrlf=false diff --stat` shows the real diff.

## What worked

- Grouping the issue's events by `JSONExtractString($exception_list, 1, 'value')` showed that one issue id held four different messages.
- Before relying on `_redirects` placeholder rules, I tested them on a copy of the existing `out/` under `wrangler dev`, with no build needed.

## Rules

- Never publish a URL template in JSON-LD. `structuredData.test.ts` scans every graph for `{`.
- Every page depth in the sitemap needs a trailing-slash 301 rule. `src/app/redirects.test.ts` fails otherwise.
