/**
 * Minimal, dependency-free i18n for the downloader's core flow.
 *
 * Deliberately not next-intl/react-i18next: the site is a static export whose
 * pages are English (that is where search traffic lands, and hreflang says so),
 * and what needs translating is the interactive app after hydration — a few
 * dozen strings. A dictionary plus an external-store locale (the same shape as
 * proSignals/history, which is what makes it hydration-safe: server and first
 * client render agree on 'en', and useSyncExternalStore re-renders with the
 * stored choice after mount) covers exactly that with zero dependencies.
 *
 * Arabic ships RTL: `setLocale` mirrors `document.documentElement`'s `dir`,
 * which Tailwind's logical properties pick up across the app shell.
 *
 * Coverage note, stated honestly rather than hidden: deep copy — platform
 * landing pages, FAQs, legal text, secondary hints — remains English. The
 * keys here are the paste → resolve → download loop a visitor physically
 * operates; everything else staying English is a known, accepted edge until
 * each surface is added deliberately.
 */

export const LOCALES = ['en', 'es', 'pt', 'id', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  id: 'Bahasa Indonesia',
  ar: 'العربية',
}

export const RTL_LOCALES: readonly Locale[] = ['ar']

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly string[]).includes(value as string)
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

/** Stable ids — never the English text itself, so renaming copy cannot rot keys. */
export type TKey =
  | 'pastePlaceholder'
  | 'paste'
  | 'pasteAria'
  | 'downloadBtn'
  | 'processing'
  | 'downloadingBtn'
  | 'preparingDownload'
  | 'cancelDownload'
  | 'downloadCanceled'
  | 'progressLine'
  | 'clickToDownload'
  | 'videoBtn'
  | 'videoSlideshowBtn'
  | 'extractAudio'
  | 'downloadAudioBtn'
  | 'msgProcessed'
  | 'msgVideoDone'
  | 'msgDownloadStarted'
  | 'msgSlideshowDone'
  | 'msgAudioDone'
  | 'msgImagesDone'
  | 'recent'
  | 'clear'
  | 'export'
  | 'importLabel'
  | 'showLess'
  | 'viewAll'
  | 'savedLink'
  | 'thumbnailBtn'
  | 'thumbnailSaving'
  | 'thumbnailUnavailable'
  | 'langLabel'
  | 'tryAgain'
  | 'sendToApp'
  | 'sendFailed'
  | 'filterRecent'
  | 'importBadFile'
  | 'importUnreadable'
  | 'importedLinks'
  | 'importNothingNew'
  | 'dropHint'

const en: Record<TKey, string> = {
  pastePlaceholder: 'Paste a video link.',
  paste: 'Paste',
  pasteAria: 'Paste link from clipboard',
  downloadBtn: 'Download',
  processing: 'Processing...',
  downloadingBtn: 'Downloading...',
  preparingDownload: 'Preparing your download…',
  cancelDownload: 'Cancel',
  downloadCanceled: 'Download canceled.',
  progressLine: 'Downloading… {pct}%',
  clickToDownload: 'Click to download your content',
  videoBtn: 'Video',
  videoSlideshowBtn: 'Video (slideshow)',
  extractAudio: 'Extract Audio',
  downloadAudioBtn: 'Download Audio',
  msgProcessed: 'Content processed successfully!',
  msgVideoDone: 'Video downloaded successfully! 🎉',
  msgDownloadStarted: 'Download started. Check your downloads. 🎉',
  msgSlideshowDone: 'Slideshow video rendered and downloaded! 🎬',
  msgAudioDone: 'Audio downloaded successfully! 🎵',
  msgImagesDone: '{n} image(s) downloaded individually! 🖼️',
  recent: 'Recent',
  clear: 'Clear',
  export: 'Export',
  importLabel: 'Import',
  showLess: 'Show less',
  viewAll: 'View all ({n})',
  savedLink: 'Saved link',
  thumbnailBtn: 'Save thumbnail',
  thumbnailSaving: 'Saving…',
  thumbnailUnavailable: 'Thumbnail unavailable',
  langLabel: 'Language',
  tryAgain: 'Try again',
  sendToApp: 'Send to an app',
  sendFailed: 'Could not send it',
  filterRecent: 'Filter recent…',
  importBadFile: 'That file is not a history export.',
  importUnreadable: 'Could not read that file.',
  importedLinks: 'Imported {n} link(s).',
  importNothingNew: 'Nothing new to import.',
  dropHint: 'Drop the link to start',
}

/**
 * English only until another language is chosen. The other four are a chunk of
 * their own, so a visitor who never leaves English never downloads them; the
 * store calls loadDictionaries before it switches.
 */
const DICTS: Partial<Record<Locale, Partial<Record<TKey, string>>>> = { en }

export async function loadDictionaries(): Promise<void> {
  const { dictionaries } = await import('./i18nDictionaries')
  Object.assign(DICTS, dictionaries)
}

/** Replace `{name}` placeholders; missing vars leave the token visible. */
function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/**
 * Look up `key` for `locale`, falling back per-key to English. A missing var
 * or an untranslated key degrades to readable copy, never to a crash.
 */
export function translate(
  locale: Locale,
  key: TKey,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[locale] ?? {}
  const template = dict[key] ?? en[key]
  return fill(template, vars)
}
