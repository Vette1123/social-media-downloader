// The `_headers` rules for the extension-less PNGs a build emits.
//
// The asset server infers Content-Type from the file extension, and generated
// OpenGraph / Twitter / icon images have none, so each needs an explicit rule.
// A `_headers` file may hold at most 100 rules, and one rule per file stopped
// fitting once every locale got its own share cards (4 locales x 14 pages x 2
// cards = 112 on their own).
//
// Share cards therefore collapse into placeholder rules. `:name` matches one
// path segment, and no page URL ends in `/opengraph-image` or `/twitter-image`,
// so these can never hand an HTML page an image/png Content-Type. Everything
// else (icons, splash screens, the root card) is still listed one by one,
// because those paths interleave with real routes.

const CARD = /^\/(?:[^/]+\/){1,2}(opengraph-image|twitter-image)$/

export const CARD_PATTERNS = [
  '/:a/opengraph-image',
  '/:a/twitter-image',
  '/:a/:b/opengraph-image',
  '/:a/:b/twitter-image',
]

/**
 * @param {string[]} urls URL paths of the extension-less PNGs, e.g. `/es/tiktok-downloader/opengraph-image`
 * @param {string[]} headers the headers every image rule carries
 * @returns {Array<[string, string[]]>} rules, placeholder rules first
 */
export function imageHeaderRules(urls, headers) {
  const sorted = [...urls].sort()
  const cards = sorted.filter((url) => CARD.test(url))
  const rest = sorted.filter((url) => !CARD.test(url))
  const patterns = cards.length > 0 ? CARD_PATTERNS : []
  return [...patterns, ...rest].map((path) => [path, headers])
}
