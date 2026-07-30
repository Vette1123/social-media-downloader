/**
 * Tiny, bounded HTML value extractors.
 *
 * These replace the handful of `cheerio.load()` calls the scrapers used to make.
 * Cheerio builds a full DOM for the whole document, which on the pages we scrape
 * (Facebook and Instagram ship 1-3 MB of markup) costs hundreds of milliseconds
 * of CPU — far past the 10 ms per-request CPU budget on the Cloudflare Workers
 * free plan, and wasteful everywhere else given we only ever read four or five
 * values per page.
 *
 * Everything here is a bounded scan over a slice of the raw markup instead. The
 * targets are machine-generated (`og:` meta tags, embedded JSON, a couple of
 * fixed class names), and the surrounding scrapers already regex the same
 * documents for the values that matter most (`playAddr`, `video_url`,
 * `is_video`), so this stays consistent with how the module already reads these
 * pages — it is not new hazard, just less of it.
 *
 * Two properties keep these safe against pathological input:
 *   - every scan is capped (see SCAN_LIMIT / headSlice)
 *   - no pattern nests unbounded quantifiers, so none can backtrack
 *     catastrophically
 */

// `og:`/`twitter:` metadata and <title> live in <head>, which is comfortably
// inside the first quarter-megabyte on every page we scrape. Slicing first
// bounds the work regardless of how large the document body is.
const HEAD_SCAN_LIMIT = 262_144

// Ceiling for scans that legitimately need the body (embedded JSON blobs,
// download links). Still bounded so a hostile or broken response can't burn the
// whole CPU budget.
const BODY_SCAN_LIMIT = 2_097_152

function headSlice(html: string): string {
  if (html.length <= HEAD_SCAN_LIMIT) return html
  // Prefer cutting at </head> when it falls inside the window, so we never split
  // a tag in half.
  const headEnd = html.lastIndexOf('</head>', HEAD_SCAN_LIMIT)
  return html.slice(0, headEnd === -1 ? HEAD_SCAN_LIMIT : headEnd)
}

function bodySlice(html: string): string {
  return html.length <= BODY_SCAN_LIMIT ? html : html.slice(0, BODY_SCAN_LIMIT)
}

// The named entities that actually show up in the titles/descriptions we read.
// A full entity table would be dead weight; anything unlisted is left as-is,
// which degrades to a cosmetic artifact in a title rather than a failure.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#34': '"',
}

/**
 * Decodes the HTML entities that appear in scraped text. Cheerio did this for
 * free; doing it explicitly keeps titles like `Ben &amp; Jerry&#39;s` readable.
 */
export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    const named = NAMED_ENTITIES[entity]
    if (named !== undefined) return named
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return match
  })
}

/**
 * Reads an attribute out of a single tag's source text. Handles double-quoted,
 * single-quoted and bare values, and is insensitive to attribute order — so
 * both `<meta property="og:title" content="x">` and the reverse parse the same.
 */
function attrFromTag(tagSource: string, attr: string): string | undefined {
  const pattern = new RegExp(`\\b${attr}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s"'>]+)`, 'i')
  const match = pattern.exec(tagSource)
  if (!match) return undefined
  const raw = match[1]
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw
  return decodeEntities(unquoted)
}

/**
 * `content` of the first <meta> whose `property` or `name` matches `key`
 * (e.g. 'og:title', 'og:image'). Returns undefined when absent or empty.
 */
export function metaContent(html: string, key: string): string | undefined {
  const scope = headSlice(html)
  const metaTag = /<meta\b[^>]*>/gi
  const lowerKey = key.toLowerCase()
  let match: RegExpExecArray | null
  while ((match = metaTag.exec(scope)) !== null) {
    const tag = match[0]
    // Cheap reject before the per-attribute regexes — most <meta> tags on these
    // pages are irrelevant, and this skips them with one substring search.
    if (!tag.toLowerCase().includes(lowerKey)) continue
    const which = attrFromTag(tag, 'property') ?? attrFromTag(tag, 'name')
    if (which?.toLowerCase() !== lowerKey) continue
    const content = attrFromTag(tag, 'content')
    if (content) return content
  }
  return undefined
}

/** Text of the document's <title>, entity-decoded and whitespace-collapsed. */
export function pageTitle(html: string): string | undefined {
  const match = /<title\b[^>]*>([\s\S]{0,2048}?)<\/title>/i.exec(headSlice(html))
  if (!match) return undefined
  const text = decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
  return text || undefined
}

/**
 * `attr` of the first `<tag …>` in the document, optionally restricted to tags
 * carrying `className`. Used for the couple of fixed-class Instagram embed
 * elements (`img.EmbeddedMediaImage`) and for a bare `<video src>`.
 */
export function firstTagAttr(
  html: string,
  tag: string,
  attr: string,
  className?: string,
): string | undefined {
  const scope = bodySlice(html)
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(scope)) !== null) {
    const source = match[0]
    if (className) {
      const classes = attrFromTag(source, 'class')
      if (!classes || !classes.split(/\s+/).includes(className)) continue
    }
    const value = attrFromTag(source, attr)
    if (value) return value
  }
  return undefined
}

/** True when at least one `<tag …>` is present. */
export function hasTag(html: string, tag: string): boolean {
  return new RegExp(`<${tag}\\b`, 'i').test(bodySlice(html))
}

/**
 * Trimmed text content of the first element carrying `className`. Inner markup
 * is stripped, matching the `.text()` behaviour the scrapers relied on.
 */
export function textOfFirstWithClass(
  html: string,
  className: string,
): string | undefined {
  const scope = bodySlice(html)
  // Locate the class occurrence first (one substring search), then parse only
  // the surrounding element — far cheaper than walking every tag.
  const classPattern = new RegExp(
    `<([a-z0-9]+)\\b[^>]*\\bclass\\s*=\\s*("[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*>`,
    'i',
  )
  const open = classPattern.exec(scope)
  if (!open) return undefined
  const start = open.index + open[0].length
  const close = scope.indexOf(`</${open[1]}`, start)
  const inner = scope.slice(start, close === -1 ? start + 4096 : close)
  const text = decodeEntities(inner.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

/**
 * Every `href` on the page pointing at a `.mp4`. Replaces a
 * `$('a[href*=".mp4"]')` selector sweep.
 */
export function mp4Hrefs(html: string): string[] {
  const scope = bodySlice(html)
  const out: string[] = []
  const anchor = /<a\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = anchor.exec(scope)) !== null) {
    const href = attrFromTag(match[0], 'href')
    if (href && href.includes('.mp4')) out.push(href)
  }
  return out
}

/**
 * Contents of the first `<script>` whose body contains `marker`. Replaces
 * iterating `$('script')` and testing each one's `.html()`.
 */
export function scriptContaining(
  html: string,
  marker: string,
): string | undefined {
  const scope = bodySlice(html)
  // Find the marker directly, then walk out to the enclosing <script> bounds.
  // This touches one region instead of materialising every script on the page.
  const at = scope.indexOf(marker)
  if (at === -1) return undefined
  const open = scope.lastIndexOf('<script', at)
  if (open === -1) return undefined
  const bodyStart = scope.indexOf('>', open)
  if (bodyStart === -1 || bodyStart > at) return undefined
  const close = scope.indexOf('</script', at)
  return scope.slice(bodyStart + 1, close === -1 ? scope.length : close)
}
