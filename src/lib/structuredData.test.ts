import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pageCopy } from './pageCopy'
import { LOCALES } from './i18n'
import { platformFor } from './localeContent'
import { platforms } from './platforms'
import {
  globalStructuredData,
  homepageStructuredData,
  jsonLdText,
  platformStructuredData,
} from './structuredData'

describe('jsonLdText', () => {
  it('cannot close its own <script> tag, and still parses to the same graph', () => {
    const graph = { name: 'a </script><img src=x onerror=alert(1)> b' }
    const text = jsonLdText(graph)
    expect(text).not.toContain('<')
    expect(JSON.parse(text)).toEqual(graph)
  })
})

// Google crawls a URL template in JSON-LD as a literal URL: the old SearchAction
// and UseAction put "/?url={search_term_string}" and "/?url={url}" into Search
// Console as pages. Every URL we publish must be a real one.
describe('structured data', () => {
  const graphs = [
    globalStructuredData,
    ...LOCALES.flatMap((locale) => [
      homepageStructuredData(locale),
      ...platforms.map((p) => platformStructuredData(p.slug, locale)),
    ]),
  ]

  it('publishes no URL template', () => {
    for (const graph of graphs) {
      const urls = JSON.stringify(graph).match(/https?:\/\/[^"\s]+/g) ?? []
      for (const url of urls) expect(url).not.toMatch(/[{}]/)
    }
  })
})

describe('platform how-to', () => {
  const howToOf = (graph: ReturnType<typeof platformStructuredData>) =>
    graph['@graph'].find((n) => n['@type'] === 'HowTo') as unknown as {
      step: Array<{ position: number; name: string; text: string }>
    }

  it.each(LOCALES)('%s: every platform has 3-4 steps, and its HowTo JSON-LD carries them', (locale) => {
    for (const { slug } of platforms) {
      const { steps } = platformFor(locale, slug)
      expect(steps.length, `${locale}/${slug}`).toBeGreaterThanOrEqual(3)
      expect(steps.length, `${locale}/${slug}`).toBeLessThanOrEqual(4)
      for (const step of steps) {
        expect(step.name.trim(), `${locale}/${slug}`).not.toBe('')
        expect(step.text.trim(), `${locale}/${slug}`).not.toBe('')
      }
      const ld = howToOf(platformStructuredData(slug, locale)).step
      expect(ld.map(({ name, text }) => ({ name, text }))).toEqual(steps)
      expect(ld.map((x) => x.position)).toEqual(steps.map((_, i) => i + 1))
    }
  })
})

describe('brand entity', () => {
  const node = (type: string) =>
    globalStructuredData['@graph'].find((n) => n['@type'] === type) as unknown as {
      sameAs: string[]
      alternateName: string[]
    }

  it('Organization.sameAs is the product, not the founder', () => {
    const { sameAs } = node('Organization')
    expect(sameAs).toEqual(['https://github.com/Vette1123/social-media-downloader'])
    expect(sameAs.join(' ')).not.toContain('twitter.com')
  })

  it('the founder keeps their own links on the Person', () => {
    expect(node('Person').sameAs.some((u) => u.includes('twitter.com'))).toBe(true)
  })

  it('WebSite and Organization are also known as the bare domain, short name first', () => {
    const expected = ['Social Downloader', 'socialdownloader.space']
    expect(node('Organization').alternateName).toEqual(expected)
    expect(node('WebSite').alternateName).toEqual(expected)
  })
})

// The English home had two titles: the layout's own literal (what Google
// showed) and pageCopy.home (what the 2026-11-10 title change edited). Every
// English home surface now reads pageCopy.home, like the four translations.
describe('English home title and description', () => {
  const webPage = (homepageStructuredData('en')['@graph'] as Array<Record<string, unknown>>).find(
    (node) => node['@type'] === 'WebPage',
  )

  it('JSON-LD WebPage uses pageCopy.home', () => {
    expect(webPage?.name).toBe(pageCopy.home.metaTitle)
    expect(webPage?.description).toBe(pageCopy.home.metaDescription)
  })

  it('the root layout <title> and description come from pageCopy.home', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(layout).toContain('const title = pageCopy.home.metaTitle')
    expect(layout).toContain('const description = pageCopy.home.metaDescription')
    expect(layout).not.toContain('siteConfig.description')
  })
})
