import { describe, expect, it } from 'vitest'
import { LOCALE_CONTENT } from '@/lib/localeContent'
import { homeOgCopy, ogCardLocale, platformOgCopy } from '@/lib/ogCopy'

describe('platformOgCopy', () => {
  it('speaks the page language, platform name intact', () => {
    const es = platformOgCopy('es', 'tiktok-downloader')
    const en = platformOgCopy('en', 'tiktok-downloader')
    expect(es.tagline).toBe(
      LOCALE_CONTENT.es.platforms['tiktok-downloader'].tagline,
    )
    expect(es.tagline).not.toBe(en.tagline)
    expect(es.free).toBe(LOCALE_CONTENT.es.copy.chips.free)
    expect(es.label).toContain('TikTok')
  })

  it('keeps the English wording for English', () => {
    expect(platformOgCopy('en', 'tiktok-downloader').label).toBe(
      'TikTok downloader',
    )
  })

  it('falls back to English for a missing key', () => {
    const original = LOCALE_CONTENT.pt.platforms['tiktok-downloader'].tagline
    try {
      LOCALE_CONTENT.pt.platforms['tiktok-downloader'].tagline = ''
      expect(platformOgCopy('pt', 'tiktok-downloader').tagline).toBe(
        platformOgCopy('en', 'tiktok-downloader').tagline,
      )
    } finally {
      LOCALE_CONTENT.pt.platforms['tiktok-downloader'].tagline = original
    }
  })
})

describe('homeOgCopy', () => {
  it('translates the home card', () => {
    expect(homeOgCopy('id').free).toBe(LOCALE_CONTENT.id.copy.chips.free)
    expect(homeOgCopy('id').free).not.toBe(homeOgCopy('en').free)
  })
})

describe('ogCardLocale', () => {
  it('draws es, pt and id in their own language, Arabic on the English card', () => {
    expect(ogCardLocale('es')).toBe('es')
    expect(ogCardLocale('pt')).toBe('pt')
    expect(ogCardLocale('id')).toBe('id')
    expect(ogCardLocale('ar')).toBe('en')
  })
})
