import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import type { RouteLocale } from '@/lib/localeRoutes'

/** A [lang] param as a language. Route files may only export what Next expects. */
export function toRouteLocale(lang: string): RouteLocale {
  if (!isLocale(lang) || lang === 'en') notFound()
  return lang
}
