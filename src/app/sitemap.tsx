import type { MetadataRoute } from 'next'
import {
  HOME_PAGE_SOURCES,
  lastChanged,
  PLATFORM_PAGE_SOURCES,
} from '@/config/build'
import { siteConfig } from '@/config/site'
import { LOCALES, type Locale } from '@/lib/i18n'
import { localePath } from '@/lib/localeRoutes'
import { languageAlternates } from '@/lib/pageMetadata'
import { platforms } from '@/lib/platforms'

// Written once at build time into out/sitemap.xml. Required explicitly by
// `output: 'export'`, which refuses to emit a metadata route that has not
// declared itself static.
export const dynamic = 'force-static'

/** The bare origin for the home page, so it matches its canonical exactly. */
function absolute(path: string): string {
  return path === '/' ? siteConfig.url : `${siteConfig.url}${path}`
}

function localeEntry(
  locale: Locale,
  path: string,
): Pick<MetadataRoute.Sitemap[number], 'url' | 'alternates'> {
  return {
    url: absolute(localePath(locale, path)),
    alternates: { languages: languageAlternates(path, absolute) },
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const home = LOCALES.map<MetadataRoute.Sitemap[number]>((locale) => ({
    ...localeEntry(locale, '/'),
    lastModified: lastChanged(HOME_PAGE_SOURCES),
    changeFrequency: 'weekly',
    priority: 1,
    images: [`${siteConfig.url}/opengraph-image`],
  }))

  const platformsChanged = lastChanged(PLATFORM_PAGE_SOURCES)
  const platformEntries = platforms.flatMap((p) =>
    LOCALES.map<MetadataRoute.Sitemap[number]>((locale) => ({
      ...localeEntry(locale, `/${p.slug}`),
      lastModified: platformsChanged,
      changeFrequency: 'monthly',
      priority: 0.8,
      images: [`${siteConfig.url}/${p.slug}/opengraph-image`],
    })),
  )

  // Static, image-free pages — no per-route opengraph-image exists for these,
  // unlike the home and platform pages above.
  const infoChanged = lastChanged(['src/lib/legalCopy.ts'])
  const staticPages = ['/pro', '/privacy', '/terms'].flatMap((path) =>
    LOCALES.map<MetadataRoute.Sitemap[number]>((locale) => ({
      ...localeEntry(locale, path),
      lastModified: infoChanged,
      changeFrequency: 'monthly',
      priority: 0.5,
    })),
  )

  return [...home, ...platformEntries, ...staticPages]
}
