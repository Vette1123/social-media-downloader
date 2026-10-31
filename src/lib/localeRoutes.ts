import { isLocale, LOCALES, type Locale } from '@/lib/i18n'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'

/**
 * Where each language lives. English keeps the bare URLs search already knows;
 * every other language sits under its own prefix and is real static HTML.
 *
 * Pure, and light enough for the client: the language picker needs this, and
 * the platform copy behind these URLs is 42 KB that must never reach a browser.
 */
export type RouteLocale = Exclude<Locale, 'en'>

export const ROUTE_LOCALES = LOCALES.filter(
  (locale): locale is RouteLocale => locale !== 'en',
)

/** The language a URL is written in, or null for the bare English URLs. */
export function localeFromPath(pathname: string | null): RouteLocale | null {
  const first = pathname?.split('/')[1]
  return isLocale(first) && first !== 'en' ? first : null
}

export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname)
  if (!locale) return pathname
  return pathname.slice(locale.length + 1) || '/'
}

export function localePath(locale: Locale, path: string): string {
  if (locale === 'en') return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

const INFO_PAGES = ['pro', 'privacy', 'terms', 'account']

export function isLocalizedPath(path: string): boolean {
  const bare = path.replace(/\/+$/, '') || '/'
  const page = bare.slice(1)
  return (
    bare === '/' ||
    INFO_PAGES.includes(page) ||
    (PLATFORM_SLUGS as readonly string[]).includes(page)
  )
}

/** This page in another language, or null for a URL that is not a page. */
export function equivalentPath(pathname: string, locale: Locale): string | null {
  const bare = stripLocale(pathname.replace(/\/+$/, '') || '/')
  return isLocalizedPath(bare) ? localePath(locale, bare) : null
}
