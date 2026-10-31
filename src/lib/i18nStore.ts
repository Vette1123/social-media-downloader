import { trackPrefChanged } from './analytics'
import {
  isLocale,
  isRtl,
  loadDictionaries,
  translate,
  type TKey,
  type Locale,
} from './i18n'
import { localeFromPath, localePath } from './localeRoutes'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore, useCallback } from 'react'

/**
 * A language in the URL always wins: that page is static HTML in that language.
 *
 * Otherwise the locale is an external store — the codebase's sanctioned shape
 * for "localStorage-backed value read by React" (see proSignals/history): the
 * server snapshot is always 'en', so prerender and hydration agree, and
 * useSyncExternalStore re-renders with the stored choice after mount without
 * a setState-in-effect anywhere.
 *
 * `document` mirroring (lang + dir for Arabic) happens imperatively beside
 * the store write, outside React's rendering.
 */

const LOCALE_KEY = 'smd:lang'

let current: Locale = 'en'
const listeners = new Set<() => void>()

export function mirrorDocument(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
}

/**
 * The locale only becomes current once its dictionary is in, so the snapshot
 * change is what re-renders with translated copy. `pending` keeps the last
 * choice winning if two loads race.
 */
let pending: Locale = 'en'

async function adopt(next: Locale): Promise<void> {
  pending = next
  if (next !== 'en') await loadDictionaries()
  if (pending !== next) return
  current = next
  for (const listener of listeners) listener()
}

// Hydrate once at first client import. Module init is outside rendering, so
// this is a store load rather than a state update during render.
if (typeof window !== 'undefined' && !localeFromPath(window.location.pathname)) {
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored) && stored !== 'en') {
      // lang and dir now, before paint. The words follow with the dictionary.
      mirrorDocument(stored)
      void adopt(stored)
    }
  } catch {
    // private mode / disabled storage — English until changed this session.
  }
}

export function getLocaleSnapshot(): Locale {
  return current
}

/** Prerender and hydration always speak English; the store takes over after. */
export function getLocaleServerSnapshot(): Locale {
  return 'en'
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setLocale(next: Locale): void {
  // Before the bail-out: on a localized URL `current` never adopted the stored
  // language, so choosing English there still has to overwrite it.
  try {
    window.localStorage.setItem(LOCALE_KEY, next)
  } catch {
    // storage disabled — the choice lives for this session only.
  }
  if (next === current) return
  mirrorDocument(next)
  trackPrefChanged({ key: 'language', value: next })
  void adopt(next)
}

/**
 * The language in effect, for the places that need it as a value rather than as
 * a lookup: `Intl` formatters, which do their own wording and only want a tag.
 */
export function useLocale(): Locale {
  const stored = useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getLocaleServerSnapshot,
  )
  return localeFromPath(usePathname()) ?? stored
}

/** Turns an English path into this page's language, for links in client code. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale()
  return useCallback((path: string) => localePath(locale, path), [locale])
}

/**
 * `const t = useT()` → `t('viewAll', { n: 12 })`. Re-renders its user when
 * the locale changes; falls back per-key to English for anything a dictionary
 * has not caught up with yet.
 */
export function useT(): (
  key: TKey,
  vars?: Record<string, string | number>,
) => string {
  const locale = useLocale()
  return useCallback(
    (key: TKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  )
}
