import { trackPrefChanged } from './analytics'
import {
  isLocale,
  isRtl,
  loadDictionaries,
  translate,
  type TKey,
  type Locale,
} from './i18n'
import { useSyncExternalStore, useCallback } from 'react'

/**
 * The locale as an external store — the codebase's sanctioned shape for
 * "localStorage-backed value read by React" (see proSignals/history): the
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

function mirrorDocument(locale: Locale): void {
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
if (typeof window !== 'undefined') {
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
  if (next === current) return
  try {
    window.localStorage.setItem(LOCALE_KEY, next)
  } catch {
    // storage disabled — the choice lives for this session only.
  }
  mirrorDocument(next)
  trackPrefChanged({ key: 'language', value: next })
  void adopt(next)
}

/**
 * `const t = useT()` → `t('viewAll', { n: 12 })`. Re-renders its user when
 * the locale changes; falls back per-key to English for anything a dictionary
 * has not caught up with yet.
 */
/**
 * The chosen language, for the places that need it as a value rather than as a
 * lookup: `Intl` formatters, which do their own wording and only want a tag.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getLocaleServerSnapshot,
  )
}

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
