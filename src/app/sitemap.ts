import type { MetadataRoute } from 'next'
import { buildDate } from '@/config/build'
import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

const lastModified = buildDate

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = {
    url: siteConfig.url,
    lastModified,
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

  const platformEntries = platforms.map<MetadataRoute.Sitemap[number]>((p) => {
    const url = `${siteConfig.url}/${p.slug}`
    return {
      url,
      lastModified,
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

  return [home, ...platformEntries]
}
