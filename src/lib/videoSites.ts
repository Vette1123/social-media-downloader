/**
 * Per-host extractors for video sites whose progressive MP4 is not in the
 * document the watch page returns to a datacenter address.
 *
 * Each host hides the file behind a different small step: an embed page that
 * carries a player hash, a token endpoint that expands into renditions, a
 * player config with escaped URLs, or a page only a relay can read. The generic
 * HTML extractor sees one document and cannot follow any of those, so each
 * shape gets the smallest recipe that does.
 *
 * Two invariants hold across the recipes:
 *
 *  - The result is always a progressive MP4. HLS is not returned: a Worker has
 *    no ffmpeg to remux it, so offering it would only produce a broken save.
 *  - Signed URLs stay bound to the requester's address. `/api/video` fetches
 *    them from the same Worker that resolved them, so the browser never needs
 *    to hold a URL minted for someone else's IP.
 */

import { decodeEntities, metaContent, pageTitle } from './htmlExtract'

export type PageFetcher = (target: string) => Promise<string | null>

/**
 * The direct page and the relay are both first-class attempts: a wall is not
 * always a tiny stub (some sites answer a plausible-sized challenge page), so
 * "the fetch succeeded" says nothing about whether the page is the one asked
 * for. Each recipe reads the direct response and falls back to the relay when
 * the content it needs is not there.
 */
export interface Fetchers {
  direct: PageFetcher
  relay: PageFetcher
}

export interface SiteResolution {
  mediaUrl: string
  title: string
  thumbnail: string
  /** The page the URL was read from, used as the media Referer. */
  pageUrl: string
}

type Kind = 'signed' | 'token' | 'embed' | 'relay'

interface Recipe {
  kind: Kind
  /** Sites that share a player payload but not their URL shapes. */
  network?: 'pornhub' | 'youporn' | 'tube8' | 'redtube'
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function recipeFor(url: string): Recipe | null {
  const host = hostnameOf(url)
  if (hostMatches(host, 'eporner.com')) return { kind: 'signed' }
  if (hostMatches(host, 'pornhub.com')) return { kind: 'token', network: 'pornhub' }
  if (hostMatches(host, 'youporn.com')) return { kind: 'token', network: 'youporn' }
  if (hostMatches(host, 'tube8.com')) return { kind: 'token', network: 'tube8' }
  if (hostMatches(host, 'redtube.com')) return { kind: 'token', network: 'redtube' }
  if (hostMatches(host, 'xvideos.com') || hostMatches(host, 'xnxx.com')) {
    return { kind: 'embed' }
  }
  if (hostMatches(host, 'xhamster.com') || hostMatches(host, 'xhamster.desi')) {
    return { kind: 'relay' }
  }
  return null
}

/** Slash-escaped JSON (`https:\/\/…`) is the norm in every player config. */
function unescapeSlashes(html: string): string {
  return html.includes('\\/') ? html.replace(/\\\//g, '/') : html
}

function titleOf(html: string): string {
  return metaContent(html, 'og:title') ?? pageTitle(html) ?? 'Video'
}

function thumbnailOf(html: string): string {
  return metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image') ?? ''
}

/** The first attempt that yields what the recipe needs, with its own markup. */
async function readWith<T>(
  target: string,
  fetchers: Fetchers,
  parse: (html: string) => T | null,
): Promise<{ page: string; value: T } | null> {
  for (const fetchPage of [fetchers.direct, fetchers.relay]) {
    const page = await fetchPage(target)
    if (!page) continue
    const value = parse(page)
    if (value) return { page, value }
  }
  return null
}

/**
 * The embed page carries a player hash; the watch page does not. The following
 * request turns that hash into signed renditions, and it is the only surface
 * that serves an MP4 — the `contentUrl` in the same page's structured data is
 * a decoy that answers 403 to everyone.
 */
function signedId(url: string): string | null {
  return (
    url.match(/\/video-([a-z0-9]+)/i)?.[1] ??
    url.match(/\/embed\/([a-z0-9]+)/i)?.[1] ??
    null
  )
}

/**
 * The player sends the 32-hex hash split into four 8-hex chunks, each converted
 * to base36. Reproducing it exactly is what makes the request look like the
 * player rather than a scraper.
 */
export function hashToToken(hash: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(hash)) return null
  let out = ''
  for (let i = 0; i < 32; i += 8) {
    out += Number.parseInt(hash.slice(i, i + 8), 16).toString(36)
  }
  return out
}

export function playerConfigUrl(vid: string, hash: string, now = Date.now()): string {
  const token = hashToToken(hash)
  if (!token) throw new Error('bad player hash')
  return (
    `https://www.eporner.com/xhr/video/${vid}` +
    `?hash=${token}&domain=www.eporner.com&pixelRatio=1` +
    `&embed=true&supportedFormats=mp4&_=${now}`
  )
}

interface Mp4Source {
  label?: string
  quality?: string | number
  url: string
}

function highest(sources: Mp4Source[]): string | null {
  let best: Mp4Source | null = null
  let bestHeight = -1
  for (const source of sources) {
    if (!/^https?:\/\//i.test(source.url)) continue
    const raw = String(source.quality ?? source.label ?? '')
    const height = Number(raw.match(/(\d{3,4})/)?.[1] ?? 0)
    if (height >= bestHeight) {
      best = source
      bestHeight = height
    }
  }
  return best?.url ?? null
}

/** `sources.mp4` is keyed by label (`720p HD`) with `labelShort` inside. */
export function configSource(json: unknown): string | null {
  const sources = (json as { sources?: { mp4?: Record<string, unknown> } })?.sources
    ?.mp4
  if (!sources || typeof sources !== 'object') return null
  const entries: Mp4Source[] = []
  for (const [label, value] of Object.entries(sources)) {
    if (!value || typeof value !== 'object') continue
    const src = (value as { src?: unknown }).src
    if (typeof src !== 'string') continue
    entries.push({ label, url: src })
  }
  return highest(entries)
}

async function resolveSigned(
  url: string,
  fetchers: Fetchers,
  userAgent: string,
): Promise<SiteResolution | null> {
  const id = signedId(url)
  if (!id) return null
  const pageUrl = `https://www.eporner.com/embed/${id}/`
  const found = await readWith(pageUrl, fetchers, (html) => {
    const hash = html.match(/EP\.video\.player\.hash\s*=\s*'([0-9a-f]{32})'/i)?.[1]
    if (!hash) return null
    const vid = html.match(/EP\.video\.player\.vid\s*=\s*'([a-z0-9]+)'/i)?.[1] ?? id
    return { hash, vid }
  })
  if (!found) return null
  const page = found.page
  const { hash, vid } = found.value

  let response: Response
  try {
    response = await fetch(playerConfigUrl(vid, hash), {
      headers: {
        'User-Agent': userAgent,
        Referer: pageUrl,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return null
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    return null
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    return null
  }
  const mediaUrl = configSource(json)
  if (!mediaUrl) return null

  return {
    mediaUrl,
    title: titleOf(page),
    thumbnail: thumbnailOf(page),
    pageUrl,
  }
}

/**
 * One player payload, four URL shapes. The watch page is the surface that
 * carries `mediaDefinitions`, and its `mp4` entry is a token endpoint (not a
 * file): the response is the rendition list with CDN links.
 */
function tokenTarget(
  url: string,
  network: NonNullable<Recipe['network']>,
): { id: string; pageUrl: string } | null {
  const patterns: Record<NonNullable<Recipe['network']>, RegExp> = {
    pornhub: /(?:[?&]viewkey=|\/embed\/)([a-z0-9]+)/i,
    youporn: /\/watch\/(\d+)/i,
    tube8: /\/porn-video\/(\d+)/i,
    redtube: /(?:redtube\.com\/(?:embed\/)?)(\d{5,})/i,
  }
  const id = url.match(patterns[network])?.[1]
  if (!id) return null
  const pages: Record<NonNullable<Recipe['network']>, string> = {
    // The embed is the smaller surface that still carries the token endpoint.
    pornhub: `https://www.pornhub.com/embed/${id}`,
    youporn: `https://www.youporn.com/watch/${id}`,
    tube8: `https://www.tube8.com/porn-video/${id}/`,
    redtube: `https://www.redtube.com/${id}`,
  }
  return { id, pageUrl: pages[network] }
}

/**
 * The mp4 entry of `mediaDefinitions`, already unescaped.
 *
 * The page mentions `mediaDefinitions` more than once — a bootstrap line that
 * only forwards the object comes first — so this looks for the entry itself
 * rather than the enclosing script. The window after `"format":"mp4"` is
 * bounded and stops at the next `format`, which keeps a miss from scanning to
 * the end of a multi-megabyte document.
 */
export function pageMp4Endpoint(html: string): string | null {
  const text = unescapeSlashes(html)
  const at = text.search(/"format"\s*:\s*"mp4"/i)
  if (at === -1) return null
  const after = text.slice(at, at + 4_096)
  const nextFormat = after.slice(1).search(/"format"\s*:\s*"/i)
  const entry = nextFormat === -1 ? after : after.slice(0, nextFormat + 1)
  const match = entry.match(/"videoUrl"\s*:\s*"([^"]+)"/i)
  return match ? decodeEntities(match[1]) : null
}

export function endpointRendition(json: unknown): string | null {
  if (!Array.isArray(json)) return null
  const sources: Mp4Source[] = []
  for (const entry of json) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    if (typeof record.videoUrl !== 'string') continue
    sources.push({
      url: decodeEntities(record.videoUrl.replace(/\\\//g, '/')),
      quality:
        typeof record.quality === 'string' || typeof record.quality === 'number'
          ? record.quality
          : String(record.height ?? ''),
    })
  }
  return highest(sources)
}

async function resolveToken(
  url: string,
  network: NonNullable<Recipe['network']>,
  fetchers: Fetchers,
  userAgent: string,
): Promise<SiteResolution | null> {
  const target = tokenTarget(url, network)
  if (!target) return null

  const found = await readWith(target.pageUrl, fetchers, pageMp4Endpoint)
  if (!found) return null
  const page = found.page
  const endpoint = found.value

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers: {
        'User-Agent': userAgent,
        Referer: target.pageUrl,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return null
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    return null
  }

  let mediaUrl: string | null = null
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      mediaUrl = endpointRendition(await response.json())
    } catch {
      mediaUrl = null
    }
  } else {
    // Some hosts answer the token endpoint with the file itself.
    await response.body?.cancel().catch(() => {})
    mediaUrl = endpoint
  }
  if (!mediaUrl) return null

  return {
    mediaUrl,
    title: titleOf(page),
    thumbnail: thumbnailOf(page),
    pageUrl: target.pageUrl,
  }
}

/**
 * The embed page's player config holds the progressive source. The named
 * high-quality call is the one to take; the escaped URLs beside it are mostly
 * previews and thumbnails.
 */
function embedId(url: string): string | null {
  return (
    url.match(/\/video\.([a-z0-9]+)\//i)?.[1] ??
    url.match(/\/video-([a-z0-9]+)\//i)?.[1] ??
    url.match(/\/embedframe\/([a-z0-9]+)/i)?.[1] ??
    null
  )
}

export function embedMp4(html: string): string | null {
  const text = unescapeSlashes(html)
  const high = text.match(/setVideoUrlHigh\(\s*'([^']+\.mp4[^']*)'\s*\)/i)?.[1]
  if (high) return decodeEntities(high)
  const low = text.match(/setVideoUrlLow\(\s*'([^']+\.mp4[^']*)'\s*\)/i)?.[1]
  return low ? decodeEntities(low) : null
}

async function resolveEmbed(
  url: string,
  fetchers: Fetchers,
): Promise<SiteResolution | null> {
  const id = embedId(url)
  if (!id) return null
  const host = hostnameOf(url)
  const embedUrl = `https://www.${host}/embedframe/${id}`
  const found = await readWith(embedUrl, fetchers, embedMp4)
  if (!found) return null
  const page = found.page
  const mediaUrl = found.value
  return {
    mediaUrl,
    title: titleOf(page),
    thumbnail: thumbnailOf(page),
    pageUrl: embedUrl,
  }
}

/**
 * The direct page offers only a manifest here; the same page fetched from an
 * address the site answers carries per-quality MP4s. Those links are keyed by
 * expiry, not by IP, so they stream fine from the Worker afterwards.
 */
function relayId(url: string): string | null {
  const slug = url.match(/\/videos\/([^/?#]+)/i)?.[1]
  if (!slug) return url.match(/\/embed\/([a-z0-9]+)/i)?.[1] ?? null
  return slug.match(/-([a-z0-9]{6,})$/i)?.[1] ?? slug
}

export function configMp4(html: string): string | null {
  const text = unescapeSlashes(html)
  const pattern = /"(\d{3,4})p"\s*:\s*"(https?:[^"]+?\.mp4)"/gi
  const sources: Mp4Source[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    sources.push({ quality: match[1], url: decodeEntities(match[2]) })
    if (sources.length >= 12) break
  }
  return highest(sources)
}

async function resolveRelay(
  url: string,
  fetchers: Fetchers,
): Promise<SiteResolution | null> {
  const id = relayId(url)
  if (!id) return null
  const pageUrl = /\/embed\//i.test(url)
    ? `https://xhamster.com/videos/${id}`
    : url
  const found = await readWith(pageUrl, fetchers, configMp4)
  if (!found) return null
  const page = found.page
  const mediaUrl = found.value
  return {
    mediaUrl,
    title: titleOf(page),
    thumbnail: thumbnailOf(page),
    pageUrl,
  }
}

export async function resolveVideoSite(
  url: string,
  fetchers: Fetchers,
  userAgent: string,
): Promise<SiteResolution | null> {
  const recipe = recipeFor(url)
  if (!recipe) return null
  try {
    switch (recipe.kind) {
      case 'signed':
        return await resolveSigned(url, fetchers, userAgent)
      case 'token':
        return await resolveToken(url, recipe.network!, fetchers, userAgent)
      case 'embed':
        return await resolveEmbed(url, fetchers)
      case 'relay':
        return await resolveRelay(url, fetchers)
    }
  } catch {
    return null
  }
}
