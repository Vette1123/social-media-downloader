import { describe, expect, it } from 'vitest'
import { CARD_PATTERNS, imageHeaderRules } from './headerRules.mjs'

const H = ['Content-Type: image/png']
const LOCALES = ['es', 'pt', 'id', 'ar']
const SLUGS = Array.from({ length: 13 }, (_, i) => `platform-${i}-downloader`)

// Every share card the build emits once each locale has its own.
const cards = [
  '/opengraph-image',
  '/twitter-image',
  ...SLUGS.flatMap((s) => [`/${s}/opengraph-image`, `/${s}/twitter-image`]),
  ...LOCALES.flatMap((l) => [
    `/${l}/opengraph-image`,
    `/${l}/twitter-image`,
    ...SLUGS.flatMap((s) => [`/${l}/${s}/opengraph-image`, `/${l}/${s}/twitter-image`]),
  ]),
]
const others = ['/icons/192', '/icons/512', '/splash/1170x2532', '/pro/twitter-image']

describe('image header rules', () => {
  it('fits every locale card under the 100-rule cap', () => {
    const rules = imageHeaderRules([...cards, ...others], H)
    expect(cards.length).toBeGreaterThan(100)
    expect(rules.length).toBeLessThan(20)
  })

  it('covers the root card and the non-card images one by one', () => {
    const paths = imageHeaderRules([...cards, ...others], H).map(([p]) => p)
    expect(paths).toContain('/opengraph-image')
    expect(paths).toContain('/twitter-image')
    expect(paths).toContain('/icons/192')
    expect(paths).toEqual(expect.arrayContaining(CARD_PATTERNS))
  })

  it('never lists a nested card on its own', () => {
    const paths = imageHeaderRules([...cards, ...others], H).map(([p]) => p)
    expect(paths).not.toContain('/es/tiktok-downloader/opengraph-image')
    expect(paths).not.toContain('/pro/twitter-image')
  })

  it('adds no placeholder rules when there are no cards', () => {
    expect(imageHeaderRules(['/icons/192'], H)).toEqual([['/icons/192', H]])
  })
})
