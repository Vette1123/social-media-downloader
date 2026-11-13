/**
 * The search-facing head of a page, and what is wrong with it.
 *
 * Pure so the deploy can run it twice: on the build before `wrangler deploy`
 * (a page in the sitemap that is noindex, canonicalised elsewhere or missing a
 * title never ships), and on the live origin after it (the edge serves what
 * was built). Regex, not a parser: the input is our own Next export, whose tag
 * shapes the test pins.
 */

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] ?? null

export function seoHead(html) {
  const headHtml = html.split(/<\/head>/i)[0]
  const tags = (re) => [...headHtml.matchAll(re)].map((m) => m[0])
  const meta = (name) =>
    tags(/<meta\b[^>]*>/gi).find((t) => attr(t, 'name') === name)
  const links = tags(/<link\b[^>]*>/gi)
  const canonical = links.find((t) => attr(t, 'rel') === 'canonical')
  return {
    title: headHtml.match(/<title>([^<]*)<\/title>/i)?.[1].trim() ?? null,
    description: meta('description') ? attr(meta('description'), 'content') : null,
    robots: meta('robots') ? attr(meta('robots'), 'content') : null,
    canonical: canonical ? attr(canonical, 'href') : null,
    alternates: links
      .filter((t) => attr(t, 'rel') === 'alternate' && attr(t, 'hrefLang'))
      .map((t) => `${attr(t, 'hrefLang')} ${attr(t, 'href')}`)
      .sort(),
  }
}

/** Every reason a sitemap URL's built head would cost it its place in search. */
export function builtProblems(url, head, sitemap) {
  const out = []
  if (!head.title) out.push('no <title>')
  if (!head.description) out.push('no meta description')
  if (!head.canonical) out.push('no canonical')
  else if (head.canonical !== url) out.push(`canonical points at ${head.canonical}`)
  if (/noindex/i.test(head.robots ?? '')) out.push('robots says noindex')
  if (head.alternates.length) {
    const pairs = head.alternates.map((a) => a.split(' '))
    for (const [lang, href] of pairs) {
      if (!sitemap.has(href)) out.push(`hreflang ${lang} -> ${href} is not in the sitemap`)
    }
    if (!pairs.some(([lang, href]) => lang !== 'x-default' && href === url)) {
      out.push('hreflang set does not list the page itself')
    }
    if (!pairs.some(([lang]) => lang === 'x-default')) out.push('hreflang has no x-default')
  }
  return out
}

/** The head fields the live page serves differently from the build. */
export function liveDrift(built, live) {
  return Object.keys(built).filter(
    (k) => JSON.stringify(built[k]) !== JSON.stringify(live[k]),
  )
}
