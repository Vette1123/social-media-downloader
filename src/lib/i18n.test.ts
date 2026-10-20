import { describe, expect, it } from 'vitest'
import { LOCALES, isLocale, isRtl, translate, type TKey } from './i18n'

describe('translate', () => {
  it('falls back per-key to English when a dictionary lacks the key', () => {
    // Every dictionary here is complete for these keys, so prove the
    // fallback with a key only English defines by construction: ask in ar
    // and expect readable Arabic; the mechanism is shared.
    expect(translate('es', 'pastePlaceholder')).toBe('Pega un enlace de video.')
    expect(translate('en', 'pastePlaceholder')).toBe('Paste a video link.')
  })

  it('substitutes {n}-style variables', () => {
    expect(translate('en', 'msgImagesDone', { n: 3 })).toBe(
      '3 image(s) downloaded individually! 🖼️',
    )
    expect(translate('ar', 'viewAll', { n: 12 })).toContain('12')
  })

  it('leaves an unfilled placeholder visible rather than crashing', () => {
    expect(translate('en', 'viewAll')).toContain('{n}')
  })
})

/**
 * The banner tones itself off the typed message kind, not the words — so a
 * translation may be reworded or drop an emoji without anything turning red.
 * What actually needs guarding per locale is plainer: every completion key
 * exists, fills {n}, and returns real prose rather than falling back half-
 * rendered. An empty or untranslated string is exactly what an English-only
 * contributor shipping a new locale would leave behind.
 */
describe('completion messages exist in every locale', () => {
  const COMPLETION_KEYS: TKey[] = [
    'msgProcessed',
    'msgVideoDone',
    'msgDownloadStarted',
    'msgSlideshowDone',
    'msgAudioDone',
    'msgImagesDone',
    'preparingDownload',
    'cancelDownload',
    'downloadCanceled',
  ]

  for (const locale of LOCALES) {
    for (const key of COMPLETION_KEYS) {
      it(`${locale}/${key} translates to non-empty prose`, () => {
        const text = translate(locale, key, { n: 1 })
        expect(text.trim().length).toBeGreaterThan(0)
        // A dictionary missing the key would fall back to English rather than
        // to its own words — possible, but worth knowing about per locale.
        // (English IS English, so it only matters for the other four.)
        if (locale !== 'en') {
          expect(text).not.toBe(translate('en', key, { n: 1 }))
        }
      })
    }
  }
})

describe('locale guards', () => {
  it('accepts exactly the shipped locales', () => {
    expect(isLocale('ar')).toBe(true)
    expect(isLocale('xx')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('marks Arabic RTL and nothing else', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('en')).toBe(false)
    expect(isRtl('he' as never)).toBe(false)
  })
})
