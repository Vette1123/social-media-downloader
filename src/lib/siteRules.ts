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
 *     "heights": [1080, 720, 480],
 *     "hcap":    "\"height\":\\s*\"(\\d+)\""
 *   }]
 *
 * `id` is matched against the pasted URL and `fid` against the fetched page;
 * each contributes one capture, substituted into `media` as $1 and $2. `{h}` is
 * each height in turn, highest first, and the first that answers with something
 * other than a web page wins — a rendition that does not exist tends to answer
 * 200 with an error page rather than 404.
 *
 * `hcap` (optional) is matched against the fetched page for a height the page
 * states about itself — structured data usually carries one. That height is
 * probed first, and it is also the answer when every probe comes back as a web
 * page: a host that walls our server's address answers HEAD requests with the
 * same wall it serves for the page, so no ladder can be verified from there
 * and refusing would turn a working link into the block message. The page's
 * own height is returned unverified instead; from an address the host answers
 * normally the probe still decides.
 */

import type { ScrapedMedia } from './pageScrape'

export interface SiteRule {
  host: string
  id: string
  page: string
  fid: string
  media: string
  heights?: number[]
  hcap?: string
}

/** Probed highest-first when a rule does not name its own ladder. */
const DEFAULT_HEIGHTS = [1080, 720, 480, 360]

/**
 * At most this many renditions are probed before giving up. Each probe is a
 * HEAD request, so the cost is latency rather than CPU, but an unbounded
 * ladder on a host that answers nothing would still stall the request.
 */
const MAX_PROBES = 4

/**
 * How many path segments are tried as an id when a rule's own pattern does not
 * match. Player and embed links commonly carry the same id in a different
 * shape; this runs only after the page itself yielded nothing, so the bound
 * keeps a dead end to a few fetches.
 */
const MAX_ID_CANDIDATES = 3

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

/**
 * A rule is about a site, not one hostname: media and player hosts are
 * routinely subdomains of the watch host, and a link to either should reach
 * the same recipe. Matching stops at the label boundary, so a host that merely
 * ends in the same letters is still a different site.
 */
export function ruleFor(url: string): SiteRule | null {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return null
  }
  const host = normalizeHost(hostname)
  return (
    siteRules().find((rule) => {
      const ruleHost = normalizeHost(rule.host)
      return host === ruleHost || host.endsWith('.' + ruleHost)
    }) ?? null
  )
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
 * What a HEAD probe can tell: a file, a page (either a rendition that was
 * never encoded, which tends to answer 200 with an error page rather than
 * 404, or the wall a walled host answers a datacenter address with), or no
 * answer at all. The content type is the only reliable signal for the first —
 * HEAD keeps it to headers; the bytes are the visitor's browser's job, not
 * ours. A network failure counts as no file, same as before.
 */
type Rendition = 'serves' | 'page' | 'absent'

async function probeRendition(mediaUrl: string): Promise<Rendition> {
  try {
    const response = await fetch(mediaUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return 'absent'
    return (response.headers.get('content-type') ?? '').includes('text/html')
      ? 'page'
      : 'serves'
  } catch {
    return 'absent'
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
 * The ids to try, in order. A rule's `id` describes the shape its watch URLs
 * use; a player or embed link names the same video in a different shape, so
 * when that pattern does not match, the path segments themselves are tried.
 * Only long alphanumeric segments qualify, so slugs, route words and file
 * extensions are skipped rather than fetched.
 */
function ruleIds(rule: SiteRule, url: string): string[] {
  const matched = capture(rule.id, url)
  if (matched) return [matched]

  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return []
  }

  const seen = new Set<string>()
  const ids: string[] = []
  for (const segment of pathname.split('/')) {
    if (!/^[A-Za-z0-9]{6,}$/.test(segment) || seen.has(segment)) continue
    seen.add(segment)
    ids.push(segment)
    if (ids.length === MAX_ID_CANDIDATES) break
  }
  return ids
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

  const ids = ruleIds(rule, url)
  if (ids.length === 0) return null

  for (const id of ids) {
    const html = await fetchPage(rule.page.replace(/\$1/g, id))
    if (!html) continue

    const fid = capture(rule.fid, html)
    if (!fid) continue

    const stated = rule.hcap ? Number(capture(rule.hcap, html)) : NaN
    const ladder = (rule.heights ?? DEFAULT_HEIGHTS).slice(0, MAX_PROBES)
    const order =
      Number.isFinite(stated) && stated > 0
        ? [stated, ...ladder.filter((height) => height !== stated)].slice(0, MAX_PROBES)
        : ladder

    const result = (mediaUrl: string): ScrapedMedia => ({
      mediaUrl,
      isStream: false,
      title: pageTitle(html, id),
      thumbnail: pageThumbnail(html),
    })

    let walled: string | null = null
    for (const height of order) {
      const mediaUrl = fill(rule.media, id, fid, height)
      const verdict = await probeRendition(mediaUrl)
      if (verdict === 'serves') return result(mediaUrl)
      // The page's own height answered with a page from an egress the host does
      // not serve files to — nothing here can confirm it, and the recipe built
      // the URL the same way it would have built a verified one.
      if (verdict === 'page' && height === stated) walled = mediaUrl
    }
    if (walled) return result(walled)
  }

  return null
}
