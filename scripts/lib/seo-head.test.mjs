import { describe, expect, it } from 'vitest'
import { builtProblems, liveDrift, seoHead } from './seo-head.mjs'

const B = 'https://x.test'
const head = ({
  title = 'Save TikTok',
  desc = 'Download public TikTok videos.',
  robots = 'index, follow',
  canonical = `${B}/es/a`,
  alternates = { en: `${B}/a`, es: `${B}/es/a`, 'x-default': `${B}/a` },
} = {}) =>
  '<html><head>' +
  (title === null ? '' : `<title>${title}</title>`) +
  (desc === null ? '' : `<meta name="description" content="${desc}"/>`) +
  (robots === null ? '' : `<meta name="robots" content="${robots}"/>`) +
  (canonical === null ? '' : `<link rel="canonical" href="${canonical}"/>`) +
  Object.entries(alternates)
    .map(([l, h]) => `<link rel="alternate" hrefLang="${l}" href="${h}"/>`)
    .join('') +
  '</head><body><title>not the head</title></body></html>'

const sitemap = new Set([`${B}/a`, `${B}/es/a`])
const problems = (opts, url = `${B}/es/a`) => builtProblems(url, seoHead(head(opts)), sitemap)

describe('seoHead', () => {
  it('reads the tags Next writes, from the head only', () => {
    expect(seoHead(head())).toEqual({
      title: 'Save TikTok',
      description: 'Download public TikTok videos.',
      robots: 'index, follow',
      canonical: `${B}/es/a`,
      alternates: [`en ${B}/a`, `es ${B}/es/a`, `x-default ${B}/a`],
    })
  })
})

describe('builtProblems', () => {
  it('passes a complete, self-canonical, indexable page', () => {
    expect(problems()).toEqual([])
  })
  it('flags a missing title or description', () => {
    expect(problems({ title: null })).toContain('no <title>')
    expect(problems({ desc: '' })).toContain('no meta description')
  })
  it('flags a canonical pointing elsewhere, or none', () => {
    expect(problems({ canonical: `${B}/a` })[0]).toMatch(/^canonical points at/)
    expect(problems({ canonical: null })).toContain('no canonical')
  })
  it('flags a sitemap page that tells crawlers not to index it', () => {
    expect(problems({ robots: 'noindex, follow' })).toContain('robots says noindex')
  })
  it('flags hreflang that leaves the sitemap, skips itself, or lacks x-default', () => {
    expect(problems({ alternates: { en: `${B}/a`, es: `${B}/es/a`, 'x-default': `${B}/a`, pt: `${B}/pt/a` } }))
      .toContain(`hreflang pt -> ${B}/pt/a is not in the sitemap`)
    expect(problems({ alternates: { en: `${B}/a`, 'x-default': `${B}/a` } }))
      .toContain('hreflang set does not list the page itself')
    expect(problems({ alternates: { en: `${B}/a`, es: `${B}/es/a` } })).toContain('hreflang has no x-default')
  })
  it('accepts a page with no hreflang at all', () => {
    expect(problems({ alternates: {} })).toEqual([])
  })
})

describe('liveDrift', () => {
  it('is empty when the live head matches the build', () => {
    expect(liveDrift(seoHead(head()), seoHead(head()))).toEqual([])
  })
  it('names each field the live page serves differently', () => {
    const live = seoHead(head({ title: 'Old title', alternates: { en: `${B}/a` } }))
    expect(liveDrift(seoHead(head()), live)).toEqual(['title', 'alternates'])
  })
})
