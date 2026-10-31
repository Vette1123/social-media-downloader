import type { MetadataRoute } from 'next'
import {
  HOME_PAGE_SOURCES,
  lastChanged,
  PLATFORM_PAGE_SOURCES,
} from '@/config/build'
import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

// Written once at build time into out/sitemap.xml. Required explicitly by
// `output: 'export'`, which refuses to emit a metadata route that has not
// declared itself static.
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = {
    url: siteConfig.url,
    lastModified: lastChanged(HOME_PAGE_SOURCES),
    changeFrequency: 'weekly',
    priority: 1,
    alternates: {
      languages: {
        en: siteConfig.url,
        'x-default': siteConfig.url,
      },
    },
    images: [`${siteConfig.url}/opengraph-image`],
  }

  const platformsChanged = lastChanged(PLATFORM_PAGE_SOURCES)
  const platformEntries = platforms.map<MetadataRoute.Sitemap[number]>((p) => {
    const url = `${siteConfig.url}/${p.slug}`
    return {
      url,
      lastModified: platformsChanged,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: {
          en: url,
          'x-default': url,
        },
      },
      images: [`${url}/opengraph-image`],
    }
  })

  // Static, image-free pages — no per-route opengraph-image exists for these,
  // unlike the home and platform pages above.
  const staticPages = ['/pro', '/privacy', '/terms'].map<MetadataRoute.Sitemap[number]>(
    (path) => {
      const url = `${siteConfig.url}${path}`
      return {
        url,
        lastModified: lastChanged([`src/app${path}/page.tsx`]),
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: {
          languages: {
            en: url,
            'x-default': url,
          },
        },
      }
    },
  )

  return [home, ...platformEntries, ...staticPages]
}
