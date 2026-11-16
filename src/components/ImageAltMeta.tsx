import { ogImageAlt } from '@/lib/pageMetadata'
import type { Locale } from '@/lib/i18n'
import type { PlatformSlug } from '@/lib/platformSlugs'

/**
 * og:image:alt and twitter:image:alt in the page's own language. A share-card
 * file can only export one fixed `alt`, so a localized route had either English
 * or none; React hoists these two tags into <head> beside Next's own.
 */
export function ImageAltMeta({ locale, slug }: { locale: Locale; slug?: PlatformSlug }) {
  const alt = ogImageAlt(locale, slug)
  return (
    <>
      <meta property='og:image:alt' content={alt} />
      <meta name='twitter:image:alt' content={alt} />
    </>
  )
}
