import { describe, expect, it } from 'vitest'
import {
  changeReason,
  htmlRouteFor,
  pageFingerprint,
  removedUrls,
  sitemapUrls,
} from './indexnow-diff.mjs'

const page = ({ title = 'T', desc = 'D', body = 'Hello', chunk = 'a1' } = {}) =>
  `<html><head><meta charSet="utf-8"/><title>${title}</title>` +
  `<meta name="description" content="${desc}"/><link rel="canonical" href="https://x.test/"/>` +
  `<link rel="stylesheet" href="/_next/static/${chunk}.css"/>` +
  `<script src="/_next/static/${chunk}.js"></script></head>` +
  `<body><main>${body}</main><script>self.__next_f.push("${chunk}")</script></body></html>`

describe('pageFingerprint', () => {
  it('ignores per-build chunk hashes', () => {
    expect(pageFingerprint(page({ chunk: 'a1' }))).toBe(pageFingerprint(page({ chunk: 'b2' })))
  })
  it('ignores the order tags arrive in (live HTML moves some metas)', () => {
    const a = '<head><meta name="a" content="1"/><meta name="b" content="2"/></head><body>x</body>'
    const b = '<head><meta name="b" content="2"/><meta name="a" content="1"/></head><body>x</body>'
    expect(pageFingerprint(a)).toBe(pageFingerprint(b))
  })
  it('ignores the content hash on generated share images', () => {
    const tag = (h) => `<head><meta property="og:image" content="https://x.test/a/opengraph-image?${h}"/></head><body>x</body>`
    expect(pageFingerprint(tag('62a07ddb71d7fae7'))).toBe(pageFingerprint(tag('ab3fe6d8d2931cb6')))
  })
  it('sees a title, description or text change', () => {
    const base = pageFingerprint(page())
    expect(pageFingerprint(page({ title: 'New' }))).not.toBe(base)
    expect(pageFingerprint(page({ desc: 'New' }))).not.toBe(base)
    expect(pageFingerprint(page({ body: 'New' }))).not.toBe(base)
  })
})

describe('changeReason', () => {
  const liveSitemap = new Set(['https://x.test/a'])
  const base = { url: 'https://x.test/a', liveSitemap }
  it('is null for an identical page', () => {
    expect(changeReason({ ...base, built: page(), live: page({ chunk: 'zz' }) })).toBeNull()
  })
  it('says changed when the text moved', () => {
    expect(changeReason({ ...base, built: page({ body: 'X' }), live: page() })).toBe('changed')
  })
  it('says new for a URL absent from the live sitemap', () => {
    expect(changeReason({ ...base, url: 'https://x.test/b', built: page(), live: null })).toBe('new')
  })
  it('submits when the live page cannot be read', () => {
    expect(changeReason({ ...base, built: page(), live: null })).toBe('live-unreadable')
  })
  it('skips a listed page the export has no file for', () => {
    expect(changeReason({ ...base, built: null, live: null })).toBeNull()
  })
})

it('reads only page <loc>, not image <loc>', () => {
  const xml =
    '<urlset><url><loc>https://x.test/a</loc><image:image><image:loc>https://x.test/a/og</image:loc></image:image></url></urlset>'
  expect([...sitemapUrls(xml)]).toEqual(['https://x.test/a'])
})

it('maps URLs to exported files', () => {
  const base = 'https://x.test'
  expect(htmlRouteFor('https://x.test', base)).toBe('index.html')
  expect(htmlRouteFor('https://x.test/', base)).toBe('index.html')
  expect(htmlRouteFor('https://x.test/ar/pro', base)).toBe('ar/pro.html')
  expect(htmlRouteFor('https://other.test/a', base)).toBeNull()
})

it('lists URLs the build dropped', () => {
  expect(removedUrls(new Set(['a', 'b']), new Set(['a']))).toEqual(['b'])
})
