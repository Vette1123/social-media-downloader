# A Facebook reel that was never public

## What

`facebook.com/share/r/1DXirAnNnd/` returned 422. The share link resolves fine, to reel
2582177208918717. Facebook serves that reel to logged-out visitors as an empty shell:
the plugin page is 52 KB with no sources, the crawler page has the title "Facebook", no
Open Graph tags and no video URL, and Cobalt answers `error.api.fetch.empty`. The control
reel in `cf-smoke` returns 200 KB from the plugin with `hd_src` and `sd_src`, a real title
and tags from the crawler, and resolves on production. No code changed. The 422 message
already says what happened.

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

## What worked

- Comparing the same four signals for both reels: size, title, Open Graph tags, source keys.
- Spaced requests, tens at most, after earlier ones timed out.

## Rules

- Debug one failing link by comparing it with a control through the same surface.
- Title "Facebook" with no `og:` tags in the crawler view means logged-out visitors get
  nothing. Stop there; only an account could reach it.
- The crawler view of a public reel also holds `browser_native_hd_url`. It is the next
  surface to try if the plugin route ever stops returning sources.
