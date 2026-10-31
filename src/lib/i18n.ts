/**
 * Minimal, dependency-free i18n for the downloader's core flow.
 *
 * Deliberately not next-intl/react-i18next: a dictionary plus a locale read from
 * the URL or an external store (the same shape as proSignals/history) covers the
 * interactive strings with zero dependencies.
 *
 * Two audiences. A localized URL (/es, /ar/tiktok-downloader) is static HTML in
 * that language: its route hands this module the dictionary, so prerender and
 * hydration agree. On an English URL a stored choice takes over after mount.
 *
 * Arabic ships RTL: `dir` is mirrored onto `document.documentElement`, which
 * Tailwind's logical properties pick up across the app shell.
 *
 * Marketing copy lives in pageCopy and src/content/locales, not here, because it
 * must never reach the client. Legal pages, /pro and rare failure messages
 * remain English.
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
  | 'homeLabel'
  | 'homeTitle'
  | 'signIn'
  | 'supportProject'
  | 'supportShort'
  | 'supportEarned'
  | 'pinOff'
  | 'pinOn'
  | 'yourAccount'
  | 'proHeroFree'
  | 'proHeroLink'
  | 'dismiss'
  | 'ourApps'
  | 'appCardTitle'
  | 'installTitle'
  | 'installIos'
  | 'installAndroid'
  | 'installShare'
  | 'installAction'
  | 'installDismiss'
  | 'copyLink'
  | 'copied'
  | 'shareLink'
  | 'shareFailed'
  | 'heroHint'
  | 'format'
  | 'formatAria'
  | 'formatAudio'
  | 'quality'
  | 'qualityAria'
  | 'dataSaver'
  | 'reset'
  | 'errorEmpty'
  | 'errorLongPress'
  | 'errorNotLink'
  | 'errorClipboard'
  | 'narrateReading'
  | 'narrateSlow'
  | 'narrateLong'
  | 'savedAgo'
  | 'savedOn'
  | 'seeHow'
  | 'pastedLinks'
  | 'pastedLinksHint'
  | 'supportCta'
  | 'alreadyDownloaded'
  | 'removeRecent'
  | 'thumbnailAlt'
  | 'byAuthor'
  | 'viewOn'
  | 'viewOriginal'
  | 'showPreview'
  | 'hidePreview'
  | 'previewUnavailable'
  | 'videoUnsupported'
  | 'pressPlay'
  | 'selectToDownload'
  | 'selectAll'
  | 'selectNone'
  | 'clickPlay'
  | 'clickPreview'
  | 'zipLabel'
  | 'zipOn'
  | 'zipOff'
  | 'downloadSelected'
  | 'getItAs'
  | 'getItAsAria'
  | 'saveBoth'
  | 'iosSavedFiles'
  | 'offerMasareefHeadline'
  | 'offerMasareefBody'
  | 'offerMasareefCta'
  | 'offerMasareefLabel'
  | 'offerRafiqHeadline'
  | 'offerRafiqBody'
  | 'offerRafiqCta'
  | 'iosSaveHint'

export type Dictionary = Partial<Record<TKey, string>>

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
  homeLabel: 'Downloader',
  homeTitle: 'Back to the downloader',
  signIn: 'Sign in',
  supportProject: 'Support this project',
  supportShort: 'Support',
  supportEarned: '{n} today — batch them for ${price}?',
  pinOff: 'Unpin the account button',
  pinOn: 'Keep the account button on screen',
  yourAccount: 'Your account',
  proHeroFree: 'Free, no account, no limits.',
  proHeroLink: 'Support the project →',
  dismiss: 'Dismiss',
  ourApps: 'Our apps',
  appCardTitle: '{app} — an app made by us, on {stores}',
  installTitle: 'Install the app',
  installIos: 'Tap Share, then “Add to Home Screen”.',
  installAndroid: 'Share videos straight from TikTok. No browser, no paste.',
  installShare: 'Share',
  installAction: 'Install',
  installDismiss: 'Dismiss install prompt',
  copyLink: 'Copy link',
  copied: 'Copied ✓',
  shareLink: 'Share link',
  shareFailed: 'Could not share',
  heroHint: 'Videos, reels, shorts, MP3 audio & photo carousels — paste several links to grab them in one go',
  format: 'Format',
  formatAria: 'Download format',
  formatAudio: 'Audio (MP3)',
  quality: 'Quality',
  qualityAria: 'Preferred video quality',
  dataSaver: 'Data saver',
  reset: 'reset',
  errorEmpty: 'Please paste a TikTok, Twitter/X, Instagram, Facebook, or YouTube URL first',
  errorLongPress: 'Long-press the field and choose Paste.',
  errorNotLink: 'That doesn’t look like a link — paste a post URL.',
  errorClipboard: 'Couldn’t read the clipboard — paste the link manually.',
  narrateReading: 'Reading the link…',
  narrateSlow: 'Still working — some sources answer slowly.',
  narrateLong: 'Still going. You can leave this open — it will finish or say why.',
  savedAgo: 'Saved {ago}',
  savedOn: 'Saved on {date}',
  seeHow: 'See how',
  pastedLinks: '{n} links.',
  pastedLinksHint: 'These save to Recent to download one at a time. Supporters get a queue that runs the whole list.',
  supportCta: 'Support this — ${price}/month',
  alreadyDownloaded: 'Already downloaded',
  removeRecent: 'Remove {title} from recent',
  thumbnailAlt: 'Video thumbnail',
  byAuthor: 'by {author}',
  viewOn: 'View on {site}',
  viewOriginal: 'View original post',
  showPreview: 'Show preview',
  hidePreview: 'Hide preview',
  previewUnavailable: 'Preview unavailable, but download should work',
  videoUnsupported: 'Your browser does not support the video tag.',
  pressPlay: 'Press play to preview — nothing streams until you do.',
  selectToDownload: 'Select {noun} to download:',
  selectAll: 'All',
  selectNone: 'None',
  clickPlay: 'Click to play',
  clickPreview: 'Click to preview',
  zipLabel: 'Download as ZIP file',
  zipOn: 'Selected {noun} arrive as one ZIP file',
  zipOff: 'Selected {noun} download one by one',
  downloadSelected: 'Download selected',
  getItAs: 'Get it as',
  getItAsAria: 'Re-download as',
  saveBoth: 'Save both — video and MP3',
  iosSavedFiles: 'Saved to Files. “Send to an app” above drops it straight into Photos or a chat.',
  offerMasareefHeadline: 'Know where your money went',
  offerMasareefBody: 'Masareef is an offline-first, multi-currency spending tracker, from the people behind this site.',
  offerMasareefCta: 'Get Masareef',
  offerMasareefLabel: 'Our app',
  offerRafiqHeadline: 'Prayer, Qur’an and adhkar in one place',
  offerRafiqBody: 'Rafiq is a private companion for prayer, Qur’an, adhkar and qibla, from the people behind this site.',
  offerRafiqCta: 'Get Rafiq',
  iosSaveHint: 'On iPhone it saves to Files. To add it to Photos, open the file, tap Share, then Save Video.',
}

/**
 * English only until another language is chosen. The other four are a chunk of
 * their own, so a visitor who never leaves English never downloads them; the
 * store calls loadDictionaries before it switches.
 */
const DICTS: Partial<Record<Locale, Dictionary>> = { en }

/** A localized route brings its own dictionary; see RouteDictionary. */
export function registerDictionary(locale: Locale, dictionary: Dictionary): void {
  DICTS[locale] = dictionary
}

export async function loadDictionaries(): Promise<void> {
  const { dictionaries } = await import('./i18nDictionaries')
  Object.assign(DICTS, dictionaries)
}

/** Replace `{name}` placeholders; missing vars leave the token visible. */
export function fill(template: string, vars?: Record<string, string | number>): string {
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
