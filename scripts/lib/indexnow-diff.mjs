/**
 * Decides which URLs a deploy actually changed, so IndexNow hears about those
 * and nothing else. Bing asks for changed URLs only; pinging every URL on every
 * deploy trains it to ignore the pings.
 *
 * A page's fingerprint is what a search engine indexes: title, meta tags,
 * canonical, hreflang, JSON-LD and visible text. Script and style tags are
 * dropped, so the per-build chunk hashes Next writes into every page don't count.
 */

const LD_JSON = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/
const META = /<meta\s[^>]*>/g
const LINKS = /<link\s[^>]*rel="(?:canonical|alternate)"[^>]*>/g

export function pageFingerprint(html) {
  const title = html.match(TITLE)?.[1]?.trim() ?? ''
  // Sorted: the same tags can arrive in another order from build to build.
  // The ?hash on og:image / twitter:image is a content hash of the rendered PNG,
  // and it differs between a Windows and a Linux build of the same source.
  const metas = (html.match(META) ?? [])
    .filter((tag) => !/charSet|name="viewport"|name="next-size-adjust"/i.test(tag))
    .map((tag) => tag.replace(/(\/(?:opengraph|twitter)-image)\?[\w-]+/, '$1'))
    .sort()
  const links = [...(html.match(LINKS) ?? [])].sort()
  const ldJson = [...html.matchAll(LD_JSON)].map((m) => m[1].trim())
  const body = (html.split(/<body[^>]*>/)[1] ?? html)
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [title, ...metas, ...links, ...ldJson, body].join('\n')
}

/** `<loc>` values of a sitemap body. `<image:loc>` does not match, so images stay out. */
export function sitemapUrls(xml) {
  return new Set(
    [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
      .map((m) => m[1].match(/<loc>([^<]+)<\/loc>/)?.[1].trim())
      .filter(Boolean),
  )
}

/**
 * Where a URL's prerendered file sits in the static export: `/` is
 * `index.html`, `/ar` is `ar.html`, `/ar/pro` is `ar/pro.html`. Null for a URL
 * outside the origin.
 */
export function htmlRouteFor(url, baseUrl) {
  if (!url.startsWith(baseUrl)) return null
  const rest = url.slice(baseUrl.length).replace(/^\/|\/$/g, '')
  return `${rest || 'index'}.html`
}

/**
 * One verdict per URL, or null for unchanged. `built` is the new HTML (null when
 * the export has no file for the URL), `live` the HTML served now (null when it
 * could not be fetched).
 */
export function changeReason({ url, liveSitemap, built, live }) {
  if (!liveSitemap.has(url)) return 'new'
  if (built === null) return null
  if (live === null) return 'live-unreadable'
  return pageFingerprint(built) === pageFingerprint(live) ? null : 'changed'
}

/** URLs the live sitemap lists that the new build dropped. Sent so engines see the 404. */
export function removedUrls(liveSitemap, builtSitemap) {
  return [...liveSitemap].filter((url) => !builtSitemap.has(url))
}
