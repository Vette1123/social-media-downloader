import { describe, expect, it } from 'vitest'
import {
  extractMediaFromHtml,
  FAST_SCAN_BYTES,
  MAX_SCAN_BYTES,
  readCappedText,
  scrapeTitle,
} from './pageScrape'

const BASE = 'https://example.com/watch/123'

describe('picking the real file over a preview', () => {
  it('prefers the player source over an og:video preview clip', () => {
    // The reported bug: og:video routinely holds a short teaser so social
    // embeds autoplay something cheap. Taking it first fetched the preview.
    const html = `
      <meta property="og:video" content="https://cdn.example.com/preview/clip.mp4">
      <video><source src="https://cdn.example.com/full/movie-1080p.mp4"></video>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/full/movie-1080p.mp4',
    )
  })

  it('rejects a preview even when it is the only tagged candidate but a better one exists inline', () => {
    const html = `
      <meta property="og:video" content="https://cdn.example.com/teaser.mp4">
      <script>var player = {file: "https://cdn.example.com/video/full.mp4"}</script>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/video/full.mp4',
    )
  })

  it('still returns a preview when the page offers nothing else', () => {
    // Degraded, but a short clip beats reporting failure on a page that really
    // does only publish one file.
    const html = `<meta property="og:video" content="https://cdn.example.com/preview.mp4">`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/preview.mp4',
    )
  })

  it('picks the highest resolution among several <source> qualities', () => {
    const html = `
      <video>
        <source src="https://cdn.example.com/v/360p.mp4">
        <source src="https://cdn.example.com/v/1080p.mp4">
        <source src="https://cdn.example.com/v/720p.mp4">
      </video>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/v/1080p.mp4',
    )
  })

  it('prefers a progressive file over an HLS manifest', () => {
    const html = `
      <video>
        <source src="https://cdn.example.com/v/master.m3u8">
        <source src="https://cdn.example.com/v/file.mp4">
      </video>
    `
    const result = extractMediaFromHtml(html, BASE)
    expect(result?.mediaUrl).toBe('https://cdn.example.com/v/file.mp4')
    expect(result?.isStream).toBe(false)
  })
})

describe('download links beat player URLs', () => {
  it('prefers an <a href> download link over the JSON-LD contentUrl', () => {
    // Measured on a live Eporner page: the /dload/ anchors serve real bytes to
    // any IP with no Referer, while the contentUrl the same page advertises
    // answers 403. A download link is the site saying where the file is.
    const html = `
      <script type="application/ld+json">{"contentUrl":"https://gvideo.example.com/x/x.mp4"}</script>
      <a href="/dload/x/720/1234-720p.mp4">Download 720p</a>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://example.com/dload/x/720/1234-720p.mp4',
    )
  })

  it('picks the highest quality among several download links', () => {
    const html = `
      <a href="/dload/x/240/f-240p.mp4">240</a>
      <a href="/dload/x/720/f-720p.mp4">720</a>
      <a href="/dload/x/480/f-480p.mp4">480</a>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://example.com/dload/x/720/f-720p.mp4',
    )
  })

  it('prefers H.264 over the AV1 rendition at the same quality', () => {
    // AV1 is smaller but still decodes poorly in older players, and the point
    // of this app is a file that opens anywhere.
    const html = `
      <a href="/dload/x/720/f-720p-av1.mp4">720 av1</a>
      <a href="/dload/x/720/f-720p.mp4">720</a>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://example.com/dload/x/720/f-720p.mp4',
    )
  })

  it('ranks a 240p rendition below everything else', () => {
    // A site advertising its smallest file in og:video is the reported bug:
    // "it catches only small preview".
    const html = `
      <meta property="og:video" content="https://cdn.example.com/240P_1000K_x.mp4">
      <a href="/dload/x/720/f-720p.mp4">720</a>
    `
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://example.com/dload/x/720/f-720p.mp4',
    )
  })
})

describe('reaching sites the old version missed', () => {
  it('finds media that sits past the fast window but inside the full one', () => {
    // Measured on a live Pornhub page: 1.4 MB of markup with og:video at byte
    // 100,601. The 64 KB fast window finds nothing, so the wide sweep runs.
    const filler = '<p>x</p>'.repeat(Math.ceil(FAST_SCAN_BYTES / 8) + 200)
    const html = `${filler}<video src="https://cdn.example.com/deep.mp4"></video>`
    expect(html.length).toBeGreaterThan(FAST_SCAN_BYTES)
    expect(html.length).toBeLessThan(MAX_SCAN_BYTES)
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/deep.mp4',
    )
  })

  it('accepts an extension-less signed CDN URL from a trusted tag', () => {
    // Requiring a file extension rejected every token-signed URL, which is a
    // large share of "it does not work everywhere".
    const html = `<meta property="og:video:secure_url" content="https://cdn.example.com/v/9f21c?token=abc123">`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/v/9f21c?token=abc123',
    )
  })

  it('does not accept an extension-less URL scraped from loose script text', () => {
    const html = `<video></video><script>var tracking = "https://analytics.example.com/collect?id=9"</script>`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('reads a data-src on a player element', () => {
    const html = `<video data-src="https://cdn.example.com/lazy.mp4" poster="/p.jpg"></video>`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/lazy.mp4',
    )
  })

  it('reads several JSON-LD contentUrls and ranks between them', () => {
    const html = `<script type="application/ld+json">{"@type":"VideoObject",
      "contentUrl":"https:\\/\\/cdn.example.com\\/sd\\/480p.mp4",
      "video":{"contentUrl":"https:\\/\\/cdn.example.com\\/hd\\/1080p.mp4"}}</script>`
    expect(extractMediaFromHtml(html, BASE)?.mediaUrl).toBe(
      'https://cdn.example.com/hd/1080p.mp4',
    )
  })

  it('rejects an embed page offered as a media URL', () => {
    const html = `<meta property="og:video" content="https://example.com/embed/123">`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('rejects javascript: and data: candidates outright', () => {
    const html = `<video src="javascript:alert(1)"></video><video src="data:video/mp4;base64,AAAA"></video>`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })
})

describe('parsing basics', () => {
  it('decodes &amp; so signed query strings survive intact', () => {
    const html = `<video src="https://cdn.example.com/v.mp4?a=1&amp;b=2"></video>`
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

  it('flags an m3u8 as a stream, since it cannot be saved as a file', () => {
    const html = `<meta property="og:video" content="https://cdn.example.com/live.m3u8">`
    expect(extractMediaFromHtml(html, BASE)?.isStream).toBe(true)
  })

  it('returns null when the page advertises no media at all', () => {
    expect(extractMediaFromHtml('<html><body>nothing</body></html>', BASE)).toBeNull()
  })

  it('carries the og:image through as the thumbnail', () => {
    const html = `
      <video src="https://cdn.example.com/a.mp4"></video>
      <meta property="og:image" content="/thumb.jpg">
    `
    expect(extractMediaFromHtml(html, BASE)?.thumbnail).toBe(
      'https://example.com/thumb.jpg',
    )
  })
})

describe('CPU budget guards', () => {
  // The Worker gets 10 ms of CPU per request, shared with the rest of the
  // resolve. Raising this constant is the easiest way to silently spend it.
  it('keeps the fast window at or below 64 KB', () => {
    // The wide window is a transfer bound (I/O, not CPU). This one is the CPU
    // bound: it is what every page that resolves normally actually pays.
    expect(FAST_SCAN_BYTES).toBeLessThanOrEqual(65_536)
  })

  it('rejects a media-free page without running any extractor', () => {
    const html = `<html><head><title>An Article</title></head><body>${'word '.repeat(13_000)}</body></html>`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })

  it('ignores media that only appears past the full scan cap', () => {
    const filler = '<p>x</p>'.repeat(Math.ceil(MAX_SCAN_BYTES / 8) + 100)
    const html = `${filler}<meta property="og:video" content="https://cdn.example.com/late.mp4">`
    expect(extractMediaFromHtml(html, BASE)).toBeNull()
  })
})

describe('readCappedText', () => {
  it('stops reading at the cap instead of buffering the whole body', async () => {
    const body = 'a'.repeat(MAX_SCAN_BYTES * 3)
    const text = await readCappedText(new Response(body))
    expect(text.length).toBe(MAX_SCAN_BYTES)
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
