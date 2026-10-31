# A Facebook reel behind the login wall

## What

`facebook.com/share/r/1DXirAnNnd/` returned 422. The share link resolves fine, to reel
2582177208918717. Facebook serves that reel to logged-out visitors as an empty shell:
the plugin page is 52 KB with no sources, the crawler page has the title "Facebook", no
Open Graph tags and no video URL, and Cobalt answers `error.api.fetch.empty`. The control
reel in `cf-smoke` returns 200 KB from the plugin with `hd_src` and `sd_src`, a real title
and tags from the crawler, and resolves on production. Anonymous visitors still get the 422.

Opened in the owner's logged-in Chrome, with their approval for this one reel, it plays,
and a `privacy_scope` field on the page reads "Public". So the gate is on logged-out
viewers, not the audience setting. That page holds the tracks in
`extensions.all_video_dash_prefetch_representations`: separate video and audio
`base_url`s, no `browser_native_*`, signed for about four days. They return 206 with
cookies omitted, so the session is only needed to find them.

## Mistakes

- Every probe before the control was evidence about one reel, read as if it were about
  Facebook. A failing surface proves nothing until a known-good link passes through it.
  The control was in `scripts/cf-smoke.mjs` the whole time.
- A curl POST to production got 403 and a challenge page from our own WAF. It looked
  like a result. The probe needs a browser user agent.
- The two controls came back in under a second, which may be the resolve cache. The
  side-by-side against Facebook itself is what proved the plugin route still works.
- Grepping for `representations` matched player config flags, not video data. Count
  `.mp4` and `base_url` before believing a key name.

- This lesson was first titled "never public" and the report said the reel was restricted.
  An anonymous wall shows what logged-out visitors get, not the audience setting.
- `hd` and `sd` counted zero in the logged-in page, and the search nearly stopped there.
  The sources were under a different key. Count `base_url` before calling a page empty.

- Three replies called this unfixable while the Instagram session path sat in the same
  file. The owner had to point at it. "Anonymous cannot reach it" and "the site cannot
  reach it" are different claims.
- DASH tracks looked like the answer and implied a merge a Worker cannot do. Listing every
  delivery key found `progressive_urls`, muxed H.264 and AAC, one page away.

## What worked

- Headless Chrome with an empty `--user-data-dir` and `--screenshot`. It is a private
  window without spending an account, and it showed the "See more on Facebook" login
  wall where the control reel had a `<video>`. Eight more anonymous routes came back
  empty too.
- Comparing the same four signals for both reels: size, title, Open Graph tags, source keys.
- Spaced requests, tens at most, after earlier ones timed out.

## Rules

- `FB_COOKIE` follows the `ig` gate: credentialed only, last of the anonymous routes,
  never cached, and the page URL is rebuilt from the id so the cookie stays on Facebook.
- A session failure and a missing reel look alike. Read the `facebook session:` log line.
- Debug one failing link by comparing it with a control through the same surface.
- Title "Facebook" with no `og:` tags in the crawler view means logged-out visitors get
  nothing. Stop there; only an account could reach it.
- The crawler view of a public reel also holds `browser_native_hd_url`. It is the next
  surface to try if the plugin route ever stops returning sources.
