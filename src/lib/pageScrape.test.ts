import { describe, expect, it } from 'vitest'
import {
  extractMediaFromHtml,
  MAX_SCAN_BYTES,
  readCappedText,
  scrapeTitle,
} from './pageScrape'

const BASE = 'https://example.com/watch/123'

describe('extractMediaFromHtml', () => {
  it('prefers og:video:secure_url over every weaker signal', () => {
    const html = `
      <meta property="og:video:secure_url" content="https://cdn.example.com/a.mp4">
      <meta property="og:video" content="https://cdn.example.com/b.mp4">
      <video src="https://cdn.example.com/c.mp4"></video>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/a.mp4',
    )
  })

  it('reads a meta tag written content-first', () => {
    const html = `<meta content="https://cdn.example.com/x.mp4" property="og:video">`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/x.mp4',
    )
  })

  it('decodes &amp; so signed query strings survive intact', () => {
    const html = `<meta property="og:video" content="https://cdn.example.com/v.mp4?a=1&amp;b=2">`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/v.mp4?a=1&b=2',
    )
  })

  it('absolutises a relative src against the page URL', () => {
    const html = `<video src="/media/clip.mp4"></video>`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://example.com/media/clip.mp4',
    )
  })

  it('absolutises a protocol-relative src', () => {
    const html = `<meta property="og:video" content="//cdn.example.com/p.mp4">`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/p.mp4',
    )
  })

  it('falls through to the first <source> inside a <video>', () => {
    const html = `<video poster="/p.jpg"><source src="https://cdn.example.com/s.webm" type="video/webm"></video>`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/s.webm',
    )
  })

  it('reads contentUrl out of a JSON-LD VideoObject, unescaping slashes', () => {
    const html = `<script type="application/ld+json">{"@type":"VideoObject","contentUrl":"https:\\/\\/cdn.example.com\\/ld.mp4"}</script>`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/ld.mp4',
    )
  })

  it('flags an m3u8 as a stream, since it cannot be saved as a file', () => {
    const html = `<meta property="og:video" content="https://cdn.example.com/live.m3u8">`
    const result = extractMediaFromHtml(html, BASE)
    expect(result?.isStream).toBe(true)
  })

  it('does not flag a plain mp4 as a stream', () => {
    const html = `<meta property="og:video" content="https://cdn.example.com/a.mp4">`
    expect(extractMediaFromHtml(html, BASE)?.isStream).toBe(false)
  })

  it('rejects a page whose og:video is an embed page rather than a file', () => {
    const html = `<meta property="og:video" content="https://example.com/embed/123">`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('rejects javascript: and data: candidates outright', () => {
    const html = `<video src="javascript:alert(1)"></video><video src="data:video/mp4;base64,AAAA"></video>`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('returns null when the page advertises no media at all', () => {
    expect(extractMediaFromHtml('<html><body>nothing</body></html>', BASE)).toBeNull()
  })

  it('ignores media that only appears past the scan cap', () => {
    const filler = '<p>x</p>'.repeat(Math.ceil(MAX_SCAN_BYTES / 8) + 100)
    const html = `${filler}<meta property="og:video" content="https://cdn.example.com/late.mp4">`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('carries the og:image through as the thumbnail', () => {
    const html = `
      <meta property="og:video" content="https://cdn.example.com/a.mp4">
      <meta property="og:image" content="/thumb.jpg">
    `
    expect(extractMediaFromHtml(html, BASE)?.thumbnail).toBe(
      'https://example.com/thumb.jpg',
    )
  })
})

describe('readCappedText', () => {
  it('stops reading at the cap instead of buffering the whole body', async () => {
    const body = 'a'.repeat(MAX_SCAN_BYTES * 3)
    const text = await readCappedText(new Response(body))
    expect(text.length).toBeLessThan(body.length)
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns a short body whole', async () => {
    expect(await readCappedText(new Response('<html>hi</html>'))).toBe(
      '<html>hi</html>',
    )
  })

  it('returns empty string for a body-less response', async () => {
    expect(await readCappedText(new Response(null, { status: 204 }))).toBe('')
  })
})

describe('scrapeTitle', () => {
  it('prefers og:title', () => {
    expect(
      scrapeTitle(`<meta property="og:title" content="Real Title"><title>Fallback</title>`),
    ).toBe('Real Title')
  })

  it('falls back to <title>', () => {
    expect(scrapeTitle(`<title>  Just This  </title>`)).toBe('Just This')
  })

  it('never returns an empty string, so the result card always has a label', () => {
    expect(scrapeTitle('<html></html>')).toBe('Video')
  })
})
