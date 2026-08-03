/**
 * Per-host recipes for sites whose watch page is walled but whose *media* is
 * still reachable, driven entirely by configuration.
 *
 * Some hosts answer a datacenter IP with a redirect stub instead of the page.
 * The block is on the address, so no header fixes it — but it is applied to
 * the watch page, not to everything the site serves. An embed URL, which has
 * to work when a third party frames it, is frequently open to any caller, and
 * the download path it points at is frequently open too. Between the two there
 * is enough to build a working link without the page ever loading.
 *
 * Every host-specific detail lives in the `SCRAPE_SITE_RULES` secret rather
 * than here: the hostname, the shape of its URLs, and the templates. This file
 * only knows how to follow a recipe. That keeps deployment-specific knowledge
 * out of a public repository, and means a host can be added or repaired
 * without a deploy.
 *
 * SCRAPE_SITE_RULES is a JSON array:
 *
 *   [{
 *     "host":    "www.site.example",
 *     "id":      "/video-([A-Za-z0-9]+)/",
 *     "page":    "https://www.site.example/embed/$1/",
 *     "fid":     "/thumbs/static\\d+/\\d+/\\d+/\\d+/(\\d+)/",
 *     "media":   "https://www.site.example/dload/$1/{h}/$2-{h}p.mp4",
 *     "heights": [1080, 720, 480]
 *   }]
 *
 * `id` is matched against the pasted URL and `fid` against the fetched page;
 * each contributes one capture, substituted into `media` as $1 and $2. `{h}` is
 * each height in turn, highest first, and the first that answers with something
 * other than a web page wins — a rendition that does not exist tends to answer
 * 200 with an error page rather than 404.
 */

import type { ScrapedMedia } from './pageScrape'

export interface SiteRule {
  host: string
  id: string
  page: string
  fid: string
  media: string
  heights?: number[]
}

/** Probed highest-first when a rule does not name its own ladder. */
const DEFAULT_HEIGHTS = [1080, 720, 480, 360]

/**
 * At most this many renditions are probed before giving up. Each probe is a
 * HEAD request, so the cost is latency rather than CPU, but an unbounded
 * ladder on a host that answers nothing would still stall the request.
 */
const MAX_PROBES = 4

let cached: SiteRule[] | null = null

function isRule(value: unknown): value is SiteRule {
  if (!value || typeof value !== 'object') return false
  const rule = value as Record<string, unknown>
  return ['host', 'id', 'page', 'fid', 'media'].every(
    (key) => typeof rule[key] === 'string' && (rule[key] as string).length > 0,
  )
}

/**
 * Parsed once per isolate. Malformed configuration is dropped rather than
 * thrown: a typo in a secret must not take down the extractor for every other
 * site, and the affected host simply reports the block as it did before.
 */
export function siteRules(): SiteRule[] {
  if (cached) return cached
  const raw = process.env.SCRAPE_SITE_RULES?.trim()
  if (!raw) {
    cached = []
    return cached
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    cached = Array.isArray(parsed) ? parsed.filter(isRule) : []
  } catch {
    cached = []
  }
  return cached
}

/** Only for tests, which stub the environment between cases. */
export function resetSiteRules(): void {
  cached = null
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase()
}

export function ruleFor(url: string): SiteRule | null {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return null
  }
  const host = normalizeHost(hostname)
  return siteRules().find((rule) => normalizeHost(rule.host) === host) ?? null
}

/** First capture of `pattern` in `text`, or null. A bad pattern is not fatal. */
function capture(pattern: string, text: string): string | null {
  try {
    return new RegExp(pattern).exec(text)?.[1] ?? null
  } catch {
    return null
  }
}

function fill(template: string, id: string, fid: string, height: number): string {
  return template
    .replace(/\$1/g, id)
    .replace(/\$2/g, fid)
    .replace(/\{h\}/g, String(height))
}

/**
 * A rendition that exists answers with a file; one that does not tends to
 * answer 200 with an error page, so the content type is the only reliable
 * signal. HEAD keeps it to headers — the bytes are the visitor's browser's job,
 * not ours.
 */
async function serves(mediaUrl: string): Promise<boolean> {
  try {
    const response = await fetch(mediaUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return false
    return !(response.headers.get('content-type') ?? '').includes('text/html')
  } catch {
    return false
  }
}

function pageTitle(html: string, fallback: string): string {
  const title = capture('<title[^>]*>([^<]{1,180})', html)
  return title?.trim() || fallback
}

function pageThumbnail(html: string): string {
  const content = capture('<meta[^>]+og:image[^>]+content="([^"]+)"', html)
  return content ?? capture('"([^"]+\\.jpg)"', html) ?? ''
}

/**
 * Follow a host's recipe. `fetchPage` reads a URL from somewhere the site will
 * answer — the caller owns that, because it is the same relay chain the rest of
 * the blocked path uses. Returns null whenever any step comes up empty, so a
 * rule that has gone stale degrades to the block message rather than an error.
 */
export async function resolveByRule(
  url: string,
  fetchPage: (target: string) => Promise<string | null>,
): Promise<ScrapedMedia | null> {
  const rule = ruleFor(url)
  if (!rule) return null

  const id = capture(rule.id, url)
  if (!id) return null

  const html = await fetchPage(rule.page.replace(/\$1/g, id))
  if (!html) return null

  const fid = capture(rule.fid, html)
  if (!fid) return null

  const heights = (rule.heights ?? DEFAULT_HEIGHTS).slice(0, MAX_PROBES)
  for (const height of heights) {
    const mediaUrl = fill(rule.media, id, fid, height)
    if (await serves(mediaUrl)) {
      return {
        mediaUrl,
        isStream: false,
        title: pageTitle(html, id),
        thumbnail: pageThumbnail(html),
      }
    }
  }
  return null
}
