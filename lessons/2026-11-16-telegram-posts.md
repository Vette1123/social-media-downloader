# Public Telegram posts download

## What
Links like t.me/<channel>/<id> (and t.me/s/…, telegram.me) now resolve. The
media sits in the embed page Telegram's own widget loads
(`?embed=1&mode=tme`): a `<video src>` on cdn*.telesco.pe for a clip, a
`background-image:url()` per photo. The CDN answers range requests with real
MP4 bytes, no login. Parsing is `src/lib/telegramPost.ts`; the extractor is
keyed on the link inside the generic chain, so Telegram needs no platform enum,
landing page or translations.

## Mistakes
- Before this, a t.me link fell to the page scrape, which found only an
  og:image and answered "t.me blocks automated requests from our servers".
  That was false: nothing was blocked, we were reading the wrong page.

## What worked
- Reading Telegram's own channel (@telegram) for real markup: durable, public,
  and it has both clip and photo posts.

## Rules
- Before calling a site "blocked", check whether its embed/widget page carries
  the media; that is the surface built to be read by other sites.
