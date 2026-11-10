import { describe, expect, it } from 'vitest'
import { contentFor } from '@/lib/localeContent'
import { accountMetadata, platformMetadata } from '@/lib/pageMetadata'

describe('og:locale:alternate', () => {
  it('names every other language, never the page\'s own', () => {
    const og = platformMetadata('tiktok-downloader', 'es').openGraph as {
      locale: string
      alternateLocale: string[]
    }
    expect(og.locale).toBe('es_ES')
    expect(og.alternateLocale).toHaveLength(4)
    expect(og.alternateLocale).not.toContain('es_ES')
    expect(og.alternateLocale).toContain('pt_BR')
  })
})

describe('account metadata', () => {
  it('describes the account page, in its own language, and stays noindex', () => {
    const meta = accountMetadata('pt')
    expect(meta.description).toBe(contentFor('pt').copy.legal.account.intro)
    expect(meta.description).not.toBe(contentFor('pt').copy.home.metaDescription)
    expect(meta.alternates?.canonical).toBe('/pt/account')
    expect(meta.robots).toEqual({ index: false })
  })

  it('keeps the English canonical unprefixed', () => {
    expect(accountMetadata().alternates?.canonical).toBe('/account')
  })
})
