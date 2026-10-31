import ar from '@/content/locales/ar.json'
import es from '@/content/locales/es.json'
import id from '@/content/locales/id.json'
import pt from '@/content/locales/pt.json'
import { homepageFaqs } from '@/lib/homepageFaqs'
import type { Locale } from '@/lib/i18n'
import type { RouteLocale } from '@/lib/localeRoutes'
import { pageCopy, type PageCopy } from '@/lib/pageCopy'
import type { Platform, PlatformSlug } from '@/lib/platforms'
import { platforms } from '@/lib/platforms'

/** The fields of a platform page that are words. Slugs, colours and URLs are not. */
export type PlatformText = Pick<
  Platform,
  | 'brandLabel'
  | 'metaTitle'
  | 'metaDescription'
  | 'h1'
  | 'tagline'
  | 'intro'
  | 'cards'
  | 'faqs'
  | 'featureList'
>

export interface LocaleContent {
  copy: PageCopy
  homeFaqs: Array<{ q: string; a: string }>
  platforms: Record<PlatformSlug, PlatformText>
}

/** Shape held by src/lib/localeContent.test.ts, which is why the cast is safe. */
export const LOCALE_CONTENT = { ar, es, id, pt } as unknown as Record<
  RouteLocale,
  LocaleContent
>

export interface PageContent {
  copy: PageCopy
  homeFaqs: Array<{ q: string; a: string }>
  platforms: Platform[]
}

/**
 * Everything a page says, in one language. Server only: reaching for this from a
 * client component would put a whole language in the bundle.
 */
export function contentFor(locale: Locale): PageContent {
  if (locale === 'en') return { copy: pageCopy, homeFaqs: homepageFaqs, platforms }
  const content = LOCALE_CONTENT[locale]
  return {
    copy: content.copy,
    homeFaqs: content.homeFaqs,
    platforms: platforms.map((p) => ({ ...p, ...content.platforms[p.slug] })),
  }
}

export function platformFor(locale: Locale, slug: PlatformSlug): Platform {
  const platform = contentFor(locale).platforms.find((p) => p.slug === slug)
  if (!platform) throw new Error(`No platform page for ${slug}`)
  return platform
}
