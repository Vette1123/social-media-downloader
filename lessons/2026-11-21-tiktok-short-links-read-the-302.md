# TikTok short links: read the 302, do not follow it

## What
GitHub #70 (`vt.tiktok.com/<code>`, 19 failures / 6 people in 3 days) and #71 (`www.tiktok.com/t/<code>`)
failed as "inconclusive". Short links were only expanded after every extractor had already failed on
the raw code (tikwm took the code as a video id), and the late expansion followed the redirect with a
GET, pulling the whole video page. From a datacenter IP that page is challenged or times out, so the
walk returned the unchanged short link. Now `expandTikTokShortLink` reads only the `Location` header
(`redirect: 'manual'`, 3 hops, 6 s) first, and downloads the canonical `/@/video|photo/<id>` URL.
`vm.tiktok.com` "unavailable" failures are real dead codes (redirect to the home page), already correct.

## Mistakes
- The first version called ANY non-post landing "retired". A login or consent hop served to a
  datacenter IP would have told the visitor a live link was dead. Narrowed to the home page only
  (`isTikTokHomePage`); anything else falls through to the old chain.
- Could not reproduce from a home IP (the old code worked here). Production `resolve_failed` for
  `vt|/*` and `/t/*` after deploy is the real check.

## What worked
- Reading a redirect's `Location` is one small request; following it is a full page fetch that can fail.

## Rules
- Expand a short link before handing it to extractors, by reading the 3xx, never the page behind it.
- A "dead link" verdict needs a positive signal (home page), never just "not what I expected".
