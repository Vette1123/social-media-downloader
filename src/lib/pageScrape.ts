/**
 * Last-resort generic extractor: pull a media URL straight out of a page's
 * HTML, in-Worker, with no external resolver.
 *
 * Why this exists: `downloadGeneric` previously had exactly one option for an
 * unrecognised link — the Cobalt instance list — and the public instance only
 * serves a fixed set of platforms. With no self-hosted resolver configured
 * (`COBALT_API_URL` unset) every generic link therefore failed, even when the
 * page advertised its own media in a meta tag.
 *
 * What it deliberately does NOT try to be: yt-dlp. Sites that sign URLs per
 * session, obfuscate the player payload, or require login are out of reach, and
 * a Worker cannot tunnel the bytes to fix an IP-bound URL. This handles the
 * honest majority — pages that publish `og:video`, a JSON-LD `VideoObject`, or
 * a plain `<video>` element.
 *
 * The tag-reading primitives come from `htmlExtract`, which already solved
 * bounded, cheerio-free attribute extraction for the platform scrapers. This
 * module is only the candidate ordering and the "is that actually media"
 * judgement on top.
 */

import {
  firstTagAttr,
  metaContent,
  pageTitle,
  scriptContaining,
} from './htmlExtract'

/**
 * Only the head and the first stretch of body are scanned. Meta tags and
 * JSON-LD live in `<head>`, and a `<video>` element that far down is rare
 * enough not to be worth scanning a multi-megabyte page for.
 *
 * The number is a CPU decision, not a correctness one. A handful of bounded
 * scans over 64 KB is well under a millisecond; over a 4 MB video page it is
 * the whole budget. `readCappedText` stops pulling bytes at this point too, so
 * an oversized page costs neither the transfer nor the scan.
 *
 * 64 KB because that is where `<head>` ends on essentially every page that
 * bothers to publish og: tags. A site that pushes its metadata past it is
 * indistinguishable, to us, from one that has none — and that is the right
 * trade against a 10 ms budget shared with the rest of the resolve.
 */
export const MAX_SCAN_BYTES = 65_536

/**
 * The most expensive scan in the file: an unanchored URL match with no tag to
 * anchor on. Bounded well inside MAX_SCAN_BYTES because it only ever fires
 * when every structured signal has already missed, and a player config that
 * far down is not worth the sweep.
 */
const INLINE_SCAN_BYTES = 32_768

/**
 * Cheap reject before any extractor runs. One literal alternation, no capture,
 * no backtracking, one pass.
 *
 * Most pages reaching this extractor have no media at all — a mistyped link, a
 * paywall, an article. This settles that in a single sweep where the full
 * candidate list would take seven.
 */
const MEDIA_HINT =
  /og:video|twitter:player:stream|contentUrl|<video|<source|\.mp4|\.m3u8/i

/** Extensions we are willing to hand to a browser as a direct download. */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
/** Manifests: playable, but not saveable without ffmpeg. */
const STREAM_EXT = /\.(m3u8|mpd)(\?|#|$)/i

export interface ScrapedMedia {
  mediaUrl: string
  /** m3u8/mpd need a player, not a download — the caller must not offer "save". */
  isStream: boolean
  title: string
  thumbnail: string
}

/**
 * Read at most `cap` bytes of a response body and decode them as text.
 *
 * `response.text()` would buffer the entire page first, which is the expensive
 * half of scraping. Cancelling the stream at the cap also tells the origin to
 * stop sending. A multi-byte character split across the cap boundary decodes to
 * a replacement char; that only ever lands in the discarded tail.
 */
export async function readCappedText(
  response: Response,
  cap = MAX_SCAN_BYTES,
): Promise<string> {
  const body = response.body
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let read = 0
  let text = ''
  try {
    while (read < cap) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      // Trim the chunk rather than the accumulated string: a body that arrives
      // as one buffer (a small page, or any in-memory Response) would otherwise
      // sail past the cap on the first read and decode in full.
      const remaining = cap - read
      const chunk =
        value.byteLength > remaining ? value.subarray(0, remaining) : value
      read += chunk.byteLength
      text += decoder.decode(chunk, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return text
}

/** Absolutise a src that may be relative or protocol-relative. */
function absolutise(candidate: string, baseUrl: string): string {
  if (!candidate) return ''
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return ''
  }
}

function isUsableMedia(candidate: string): boolean {
  if (!candidate) return false
  // Rejects javascript:, data: and blob: — `new URL` happily absolutises those.
  if (!/^https?:\/\//i.test(candidate)) return false
  return VIDEO_EXT.test(candidate) || STREAM_EXT.test(candidate)
}

/**
 * `contentUrl` inside a JSON-LD VideoObject. Parsing the whole graph would mean
 * JSON.parse on an arbitrary blob, so pull the field directly — the shape is
 * standardised even when the surrounding graph is not. JSON-LD escapes forward
 * slashes, so `https:\/\/…` has to be unescaped.
 */
function jsonLdContentUrl(html: string): string {
  const block = scriptContaining(html, '"contentUrl"')
  if (!block) return ''
  const direct = block.match(/"contentUrl"\s*:\s*"([^"]+)"/i)
  return direct?.[1] ? direct[1].replace(/\\\//g, '/') : ''
}

/** `<video src>`, else the first `<source src>` (which is how most pages do it). */
function videoElementSrc(html: string): string {
  return (
    firstTagAttr(html, 'video', 'src') ?? firstTagAttr(html, 'source', 'src') ?? ''
  )
}

/**
 * Last resort: a media URL sitting in an inline JSON payload, which is where
 * self-hosted players (Video.js, Plyr) keep their sources. Bounded to the first
 * match so a page full of URLs cannot turn this into a long scan.
 */
function inlineMediaUrl(html: string): string {
  const scope =
    html.length > INLINE_SCAN_BYTES ? html.slice(0, INLINE_SCAN_BYTES) : html
  const match = scope.match(
    /https?:\\?\/\\?\/[^\s"'<>\\]+\.(?:mp4|webm|m3u8)(?:\?[^\s"'<>\\]*)?/i,
  )
  return match?.[0] ? match[0].replace(/\\\//g, '/') : ''
}

/**
 * Ordered by how much the site is *asserting* the URL is its media. An
 * og:video tag is a publisher statement; a URL scraped out of inline JSON is a
 * guess, so it goes last.
 *
 * Thunks, not values: the common case is a hit on the first or third entry,
 * and evaluating the list eagerly would run all seven scans — including the
 * expensive inline sweep — every single time, to throw six of them away.
 */
const CANDIDATES: Array<(html: string) => string | undefined> = [
  (html) => metaContent(html, 'og:video:secure_url'),
  (html) => metaContent(html, 'og:video:url'),
  (html) => metaContent(html, 'og:video'),
  (html) => metaContent(html, 'twitter:player:stream'),
  jsonLdContentUrl,
  videoElementSrc,
  inlineMediaUrl,
]

export function extractMediaFromHtml(
  html: string,
  baseUrl: string,
): ScrapedMedia | null {
  const scanned =
    html.length > MAX_SCAN_BYTES ? html.slice(0, MAX_SCAN_BYTES) : html

  if (!MEDIA_HINT.test(scanned)) return null

  for (const read of CANDIDATES) {
    const candidate = read(scanned)
    if (!candidate) continue
    const absolute = absolutise(candidate, baseUrl)
    if (!isUsableMedia(absolute)) continue
    return {
      mediaUrl: absolute,
      isStream: STREAM_EXT.test(absolute),
      title: scrapeTitle(scanned),
      thumbnail: absolutise(
        metaContent(scanned, 'og:image') ??
          metaContent(scanned, 'twitter:image') ??
          '',
        baseUrl,
      ),
    }
  }
  return null
}

/** Never empty, so a result card always has a label. */
export function scrapeTitle(html: string): string {
  return metaContent(html, 'og:title') ?? pageTitle(html) ?? 'Video'
}
