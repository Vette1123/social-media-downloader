import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import { LOCALES, type Locale } from '@/lib/i18n'
import { fill } from '@/lib/i18n'
import { contentFor, platformFor } from '@/lib/localeContent'
import { localePath } from '@/lib/localeRoutes'
import type { PlatformSlug } from '@/lib/platforms'

const OG_LOCALES: Record<Locale, string> = {
  en: siteConfig.locale,
  es: 'es_ES',
  pt: 'pt_BR',
  id: 'id_ID',
  ar: 'ar_AR',
}

const OG_SIZE = { width: 1200, height: 630 }

/** Every language of a page, English as the default. Paths or absolute URLs. */
export function languageAlternates(
  path: string,
  to: (localized: string) => string = (localized) => localized,
): Record<string, string> {
  const entries = LOCALES.map((locale) => [locale, to(localePath(locale, path))])
  return { ...Object.fromEntries(entries), 'x-default': to(path) }
}

function pageMetadata({
  locale,
  path,
  title,
  description,
  images,
}: {
  locale: Locale
  path: string
  title: string
  description: string
  /** Localized pages share the English card: the image limit is `_headers`. */
  images?: { og: string; twitter: string }
}): Metadata {
  const canonical = localePath(locale, path)
  return {
    title,
    description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${canonical === '/' ? '' : canonical}`,
      siteName: siteConfig.name,
      locale: OG_LOCALES[locale],
      type: 'website',
      ...(images && {
        images: [{ url: images.og, ...OG_SIZE, type: 'image/png', alt: title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: siteConfig.twitterTag,
      site: siteConfig.twitterTag,
      ...(images && { images: [{ url: images.twitter, ...OG_SIZE, alt: title }] }),
    },
  }
}

/** /pro, /privacy and /terms. /pro has its own card; the others share the home one. */
export function infoMetadata(
  page: 'pro' | 'privacy' | 'terms',
  locale: Locale = 'en',
): Metadata {
  const doc = contentFor(locale).copy.legal[page]
  const path = `/${page}`
  const root = page === 'pro' ? path : ''
  return pageMetadata({
    locale,
    path,
    title: doc.metaTitle,
    description: fill(doc.metaDescription, { site: siteConfig.name }),
    images:
      locale === 'en' && page === 'pro'
        ? undefined
        : { og: `${root}/opengraph-image`, twitter: `${root}/twitter-image` },
  })
}

export function homeMetadata(locale: Exclude<Locale, 'en'>): Metadata {
  const { home } = contentFor(locale).copy
  return pageMetadata({
    locale,
    path: '/',
    title: home.metaTitle,
    description: home.metaDescription,
    images: { og: '/opengraph-image', twitter: '/twitter-image' },
  })
}

export function platformMetadata(
  slug: PlatformSlug,
  locale: Locale = 'en',
): Metadata {
  const platform = platformFor(locale, slug)
  const path = `/${slug}`
  return pageMetadata({
    locale,
    path,
    title: platform.metaTitle,
    description: platform.metaDescription,
    images:
      locale === 'en'
        ? undefined
        : { og: `${path}/opengraph-image`, twitter: `${path}/twitter-image` },
  })
}
