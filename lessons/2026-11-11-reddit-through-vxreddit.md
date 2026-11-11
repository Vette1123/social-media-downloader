# Reddit works again, through vxreddit

## What

Reddit has refused Cloudflare egress since 2026-10-22, so every Reddit download failed with a 422
(lessons/2026-11-03-reddit-blocks-the-worker.md). The planned fix was self-hosting
`deploy/resolver`, which needs an account on a host outside Cloudflare.

vxreddit, a public link-preview fixer, fetches Reddit from AWS. For a crawler user agent, it
publishes `og:video`: a URL that muxes the post's v.redd.it video and audio into one MP4 and
redirects to the render. `tryRedditEmbed` now falls back to it when Reddit's embed gives no media.

Measured from Cloudflare's edge (`wrangler dev --remote`, throwaway Worker):

| Request | Result |
|---|---|
| `embed.reddit.com` | 403 (still blocked) |
| vxreddit post page | 200 in 3.7 s, `og:video` present |
| render | 206 `video/mp4`, 5 MB, h264 + AAC, 900p (ffprobe) |

## Mistakes

- I marked this "owner decision: needs a host outside Cloudflare" and moved on. Another
  service's own egress was already outside Cloudflare. Look for a public service that already
  sits where you need egress before asking for new hosting.
- The first probe followed only the first redirect (307 to an AWS Lambda) and the file looked
  like a 607-byte HTML page. Follow the whole chain before judging the payload.

## What worked

- A throwaway Worker under `wrangler dev --remote` answers "does this work from the edge" in a
  minute, without deploying anything.
- Checking the muxed file with ffprobe (one video and one audio stream) rather than trusting the
  content type.

## Rules

- `og:video` from the mirror is accepted only when it is `https://vxreddit.com/redditvideo.mp4?…`
  naming v.redd.it, so a changed page cannot hand users a file from elsewhere.
- If vxreddit goes away, Reddit is down again. The upgrade path is still `deploy/resolver`.
