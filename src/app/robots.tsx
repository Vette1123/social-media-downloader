import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

// Written once at build time into out/robots.txt. See sitemap.tsx.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        userAgent: [
          // Search-aware AI crawlers (allow — drives discovery)
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'Perplexity-User',
          'Google-Extended',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'Applebot',
          'Applebot-Extended',
          'Bingbot',
          'DuckDuckBot',
          'YandexBot',
        ],
        allow: '/',
        disallow: ['/api/'],
      },
      {
        // Aggressive scrapers — block
        userAgent: [
          'CCBot',
          'Bytespider',
          'Amazonbot',
          'Diffbot',
          'Omgili',
          // Backlink and SEO-audit crawlers. They send no visitors and index
          // nothing a person searches; they walk the whole site to sell the
          // resulting report. `pnpm cf:health` shows them arriving.
          'AhrefsBot',
          'SemrushBot',
          'MJ12bot',
          'DotBot',
          'DataForSeoBot',
          'SERankingBacklinksBot',
          'PetalBot',
        ],
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
