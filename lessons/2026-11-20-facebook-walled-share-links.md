# Facebook share links that open only for logged-in viewers

## What

`/share/r/` failed for 11 people and `/share/v/` for 12 in a week. Five real share
links, harvested from public GitHub issues with `gh search issues`, went through
`pnpm link:probe`: 2 resolved, 3 failed.

- Two (`r/15JaCNTNva`, `v/1Esai9Pphz`) never redirect. The link crawler gets 200 and a
  "log in or sign up to view" page. Every other crawler identity (WhatsApp, Telegram,
  Twitter, Slack, Discord, Google, on www and m) gets the same. The page names no post.
- One (`r/15B1URzika`) redirects to `/reel/<id>`, and that reel is walled for logged-out
  viewers. This is the case `2026-10-31-facebook-reel-behind-login-wall.md` covers, and
  only the operator's session reaches it.

For the first shape the chain ran four extractors on an unresolved `/share/` URL for
3 to 5 s, then said "may be private, age-restricted, or unavailable", which is filed as
`inconclusive`. It now stops after the one HEAD, in about 240 ms, with a reason filed
as `private`. A timeout or an error status still falls through to the chain.

## Mistakes

- Earlier passes searched the web and Reddit for share links, found none, and tried
  made-up codes, which only return Facebook's generic page. Bug reports in downloader
  repos paste real links; `gh search issues "facebook.com/share/r/"` found five at once.
- The first `pnpm verify` failed while the live probe ran beside it. Alone it passed,
  1869 of 1869. Do not run network probes and the suite at the same time.

## What worked

- Comparing the crawler's status per link: 302 means public, 200 on `/share/` means gated.
- Testing the decision on the real `downloadFacebook`, with `fetch` stubbed and
  `Response.url` set, plus the two answers that must not count: a thrown fetch and a 429.

## Rules

- Source real links for a failing shape from GitHub issues first.
- An unresolved share link is only the post's fault when the host answered 2xx.
