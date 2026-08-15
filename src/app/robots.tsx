import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'
import crawlers from '@/config/crawlers.json'

// Written once at build time into out/robots.txt. See sitemap.tsx.
export const dynamic = 'force-static'

// The lists live in src/config/crawlers.json because scripts/cf-setup.mjs reads
// the same file to build the WAF rules. robots.txt is a request; the WAF is the
// enforcement. Splitting the two lists is how a site ends up asking a crawler in
// here and blocking it at the edge — see the file's own comment.
const ALLOWED = [
  ...crawlers.aiCrawlers,
  ...crawlers.searchCrawlers,
  ...crawlers.robotsOnlyTokens,
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        // Search-aware AI crawlers and the search engines proper — named so the
        // allowance survives a future tightening of the wildcard rule above.
        userAgent: ALLOWED,
        allow: '/',
        disallow: ['/api/'],
      },
      {
        // Aggressive scrapers and backlink-audit crawlers: no visitors, no
        // index anyone searches, and a full walk of the site each time. The
        // ones that ignore this are blocked at the edge by the same list.
        userAgent: crawlers.disallowedScrapers,
        disallow: '/',
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    // No `host:` directive — it is a Yandex-only extension that Yandex itself
    // deprecated, and it must carry a bare hostname. Emitting it with a scheme
    // (`https://…`) makes it an invalid line that every crawler discards.
    // The www/apex preference is already expressed by the 308 redirects and the
    // rel=canonical on every page.
  }
}
