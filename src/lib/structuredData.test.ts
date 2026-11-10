import { describe, expect, it } from 'vitest'
import { LOCALES } from './i18n'
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
