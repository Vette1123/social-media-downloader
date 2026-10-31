'use client'

import { usePathname } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { registerDictionary, type Dictionary, type Locale } from '@/lib/i18n'
import { mirrorDocument, useLocale } from '@/lib/i18nStore'
import { localeFromPath } from '@/lib/localeRoutes'

/**
 * Hands a localized route its dictionary before anything under it renders, on
 * the server and during hydration alike, so neither ever speaks English first.
 * Registering is idempotent and keyed by language, which is what makes it safe
 * to do in render.
 */
export function RouteDictionary({
  locale,
  dictionary,
  children,
}: {
  locale: Locale
  dictionary: Dictionary
  children: ReactNode
}) {
  registerDictionary(locale, dictionary)
  return children
}

/**
 * The root layout's chrome renders ahead of `{children}`, so on a localized
 * route it would run before RouteDictionary. The [lang] layout mounts its own
 * copy inside the dictionary and this one stands aside.
 */
export function EnglishRouteOnly({ children }: { children: ReactNode }) {
  return localeFromPath(usePathname()) ? null : children
}

/**
 * Keeps <html lang dir> honest across client navigation. The root layout never
 * re-renders, so moving from /es to /pro would otherwise leave an English page
 * declaring itself Spanish.
 */
export function DocumentLocale() {
  const locale = useLocale()
  useEffect(() => mirrorDocument(locale), [locale])
  return null
}
