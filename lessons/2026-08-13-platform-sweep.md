# Every generic platform was dead, and one of them was pretending not to be

## What

A sweep of one live URL per supported platform against production found six
failures: Instagram (login-gated posts), Reddit, Threads, Twitch, Pinterest, and
the config-driven walled host. The common cause for four of them was a single
dependency: platforms with no bespoke extractor are resolved through Cobalt, the
deployment has no self-hosted instance (`COBALT_API_URL` is unset — confirmed
against `wrangler secret list`), and the one open public instance now answers
`error.api.fetch.fail` / `error.api.fetch.critical` for Reddit, Twitch,
Pinterest, Vimeo and rejects Threads links outright. Its address is blocked by
those origins; nothing about our request changes that.

Each of those platforms now reads its own embed surface before Cobalt:

- **Reddit** — the embed view's `packaged-media-json` attribute, which lists
  pre-muxed MP4s. The raw `v.redd.it` renditions are DASH: video and audio in
  separate files, and this deployment has no ffmpeg to join them.
- **Threads** — the post's `/embed` view, requested with a link-crawler user
  agent. A browser user agent gets a quarter-megabyte app shell with no media.
- **Twitch clips** — the public GraphQL clip query. The `sourceURL` it returns
  answers 401 on its own; it needs the signature and token from the same
  response.
- **Pinterest** — the widget API its own embed script calls, which answers with
  video renditions or, for a photo pin, the image sizes.
- **The walled host** — its recipe was being handed only the relay chain, and
  every free relay now refuses to fetch on behalf of a Worker. Fetching the
  recipe's embed page directly first is what makes it work: these hosts wall the
  watch page, not the embed.

## Mistakes

- **Three of the four "broken" samples were the wrong kind of post.** The Reddit
  URL was an image post (harvested by pairing a permalink with a *different*
  post's `data-url`), the Pinterest pin was a photo pin, and the Threads post
  was text. Cobalt's `fetch.fail` for them was partly honest. Every "platform X
  is broken" claim was re-tested against a post of the right *type* before any
  code was written; two of them changed answer.
- **Production reported Vimeo as working, and it was not.** The resolve returned
  `success: true` with a `downloadUrl` that pointed at `player.vimeo.com/video/…`
  — the player page. It streamed 32 KB of HTML through the proxy and the sweep
  scored it OK because it only checked the status. A media check that does not
  look at the content type will call an error page a video. Vimeo has been
  retiring progressive renditions; that video now ships only DASH/HLS, and the
  generic scraper had been papering over it.
- **`curl` and `fetch` are not interchangeable against a hostile origin.**
  old.reddit answered curl with 200 and node's `fetch` with 403, same URL, same
  user agent. Twenty minutes went into "reddit blocks us" that was really "reddit
  blocks this client". The embed host answers both.
- **The walled host's block was mis-diagnosed as an address block, by this file's
  own predecessor.** Running the Worker locally (`wrangler dev`) settled it: from
  one machine, one IP, one set of headers, node's fetch gets the real 8 KB embed
  page and workerd gets the same 369-byte stub production gets. The wall keys on
  the client, not the address — so no header set fixes it, and neither would a
  different datacenter. Sending a full browser header set from the Worker was
  tried and changed nothing. That host stays unresolvable from Cloudflare until
  something else fetches the page; the code says so in the error.
- Assumed the public Cobalt instance list could be refreshed from the community
  directory. Both directory hosts are dead (DNS failure), so there is no list to
  refresh — the fix had to be per-platform code, not configuration.
- The first sample-harvest script printed a walled host's name into the
  transcript. Names of those hosts stay in the config secret; see the note in
  `siteRules.ts`.

## What worked

- One scratch sweep script that resolves a list of live URLs against a
  deployment and then **fetches the returned media** with a Range request,
  printing status and content type. Every conclusion in this file came from it,
  including the false pass it exposed once the content type was printed.
- Probing an origin's *surfaces* in one pass — page, embed, oEmbed, widget API,
  JSON — and printing a keyword census (`packaged-media`, `video_versions`,
  `og:video`, byte count) rather than eyeballing HTML. The Reddit answer was a
  keyword that appeared 310 KB into one surface and nowhere else.
- Translating each new payload into the shapes the codebase already parses
  (`extractMediaFromHtml` for the Threads embed, `shortcode_media` for
  Instagram's media API) instead of writing a parser per platform.

## Rules

- A sweep that checks only `success: true` proves nothing. Fetch the media and
  check the content type; an HTML error page has bytes too.
- Before believing an extractor is broken, check the sample is a post of the
  type being extracted. Harvest permalink and media URL from the *same* element.
- When an origin refuses us, enumerate its surfaces before concluding it is
  blocked: embed hosts and widget APIs are built to answer strangers, and they
  routinely carry the media the main page hides.
- Reach for a per-platform endpoint before adding another dependency on a shared
  public resolver: the resolver's address is a single point of failure that no
  header can fix.
- Verify extractor work in `wrangler dev`, not only in vitest. It is the only
  local place the real runtime's fetch is used, and at least one origin treats it
  differently from node's.
