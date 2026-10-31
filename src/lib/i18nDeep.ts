import { useEffect, useSyncExternalStore } from 'react'
import { fill, type Locale } from '@/lib/i18n'
import { useLocale } from '@/lib/i18nStore'
import type { RouteLocale } from '@/lib/localeRoutes'

/**
 * Words a visitor reaches only by doing something: the account panel, the batch
 * queue, failure messages. There are hundreds and most visits see none, so they
 * stay out of the first-load dictionary.
 *
 * The English sentence is the key: English costs nothing, adds no lookup table,
 * and a call site still reads as the sentence it shows. Each language is its own
 * chunk, fetched only by a visitor in that language. Until it lands, or for a
 * sentence no dictionary has, the English shows.
 *
 * `d()` is a plain function so helpers and async handlers can call it without a
 * translator threaded through them. A component that shows its result calls
 * `useDeepWords()` once, which is what fetches the language and repaints when it
 * arrives. scripts/i18n-deep.mjs finds every sentence and a test fails when a
 * language is missing one.
 */
const LOADERS: Record<RouteLocale, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('@/content/locales/deep/es.json'),
  pt: () => import('@/content/locales/deep/pt.json'),
  id: () => import('@/content/locales/deep/id.json'),
  ar: () => import('@/content/locales/deep/ar.json'),
}

type Vars = Record<string, string | number>

const loaded: Partial<Record<Locale, Record<string, string>>> = {}
const requested = new Set<Locale>()
const failed = new Set<Locale>()
const listeners = new Set<() => void>()
let version = 0
// Set during render, not read off the URL: during a client navigation the new
// page renders before `window.location` changes.
let active: Locale = 'en'

export function setActive(locale: Locale): void {
  active = locale
}

export async function loadDeepWords(locale: Locale): Promise<void> {
  if (locale === 'en' || requested.has(locale)) return
  requested.add(locale)
  await LOADERS[locale]().then(
    (module) => {
      loaded[locale] = module.default
      version++
      for (const listener of listeners) listener()
    },
    // Offline or a stale chunk: English for this visit, not a wait with no end.
    () => {
      failed.add(locale)
      version++
      for (const listener of listeners) listener()
    },
  )
}

/** False while a language is on its way, so a screen can wait instead of flashing English. */
export function deepWordsReady(locale: Locale): boolean {
  return locale === 'en' || locale in loaded || failed.has(locale)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDeepWords(): boolean {
  const locale = useLocale()
  setActive(locale)
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  useEffect(() => {
    void loadDeepWords(locale)
  }, [locale])
  return deepWordsReady(locale)
}

/** A sentence written at the call. `d('{n} links saved', { n })`. */
export function d(english: string, vars?: Vars): string {
  return fill(loaded[active]?.[english] ?? english, vars)
}

/** Marks a sentence kept in data, for the extractor. Shown later with `dKnown`. */
export const dn = (english: string): string => english

export const speaksEnglish = (): boolean => active === 'en'

/** A sentence that arrives in a variable. Text no dictionary has shows as it is. */
export function dKnown(text: string): string {
  return loaded[active]?.[text] ?? text
}
