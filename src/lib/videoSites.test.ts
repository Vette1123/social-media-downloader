import { describe, expect, it } from 'vitest'
import {
  configMp4,
  configSource,
  embedMp4,
  endpointRendition,
  hashToToken,
  pageMp4Endpoint,
  playerConfigUrl,
  resolveVideoSite,
} from './videoSites'
import { extractMediaFromHtml } from './pageScrape'

/**
 * Fixtures are the real shapes, copied from the pages, including the escaped
 * slashes that the generic inline scan used to reject.
 */

describe('hashToToken', () => {
  it('splits the 32-hex hash into four base36 chunks, as the player does', () => {
    expect(hashToToken('834a1cc9a3ba626f178877ce09498a21')).toBe(
      '10fewuh19ffmgf6j2cpa2krn6p',
    )
  })

  it('rejects anything that is not a 32-hex hash', () => {
    expect(hashToToken('nope')).toBeNull()
    expect(hashToToken('834a1cc9')).toBeNull()
  })

  it('builds the player request with the converted hash and the embed flag', () => {
    const url = playerConfigUrl('rd8YLMMW0DR', '834a1cc9a3ba626f178877ce09498a21', 42)
    expect(url).toContain('/xhr/video/rd8YLMMW0DR?')
    expect(url).toContain('hash=10fewuh19ffmgf6j2cpa2krn6p')
    expect(url).toContain('embed=true')
    expect(url).toContain('_=42')
  })
})

describe('configSource', () => {
  it('picks the highest rendition, not the first key', () => {
    const json = {
      sources: {
        mp4: {
          '240p': { src: 'https://cdn.example/240.mp4' },
          '720p HD': { src: 'https://cdn.example/720.mp4' },
          '480p': { src: 'https://cdn.example/480.mp4' },
        },
      },
    }
    expect(configSource(json)).toBe('https://cdn.example/720.mp4')
  })

  it('returns null when the response carries no mp4 block', () => {
    expect(configSource({ sources: { hls: {} } })).toBeNull()
    expect(configSource(null)).toBeNull()
  })
})

describe('pageMp4Endpoint', () => {
  it('finds the mp4 entry among the HLS one and unescapes the URL', () => {
    const html = `<script>var player = {mediaDefinitions: flashvars.mediaDefinitions};</script>
    <script>var flashvars = {"mediaDefinitions":[
      {"format":"hls","videoUrl":"https:\\/\\/cdn.example\\/master.m3u8"},
      {"format":"mp4","videoUrl":"https:\\/\\/www.pornhub.com\\/video\\/get_media?s=abc&v=1"}
    ]};</script>`
    expect(pageMp4Endpoint(html)).toBe(
      'https://www.pornhub.com/video/get_media?s=abc&v=1',
    )
  })

  it('returns null when there is no player payload', () => {
    expect(pageMp4Endpoint('<html>wall</html>')).toBeNull()
  })
})

describe('endpointRendition', () => {
  it('picks the highest quality from the token response', () => {
    const json = [
      { quality: '480', videoUrl: 'https:\\/\\/cdn.example\\/480.mp4' },
      { quality: '1080', videoUrl: 'https:\\/\\/cdn.example\\/1080.mp4' },
      { quality: '720', videoUrl: 'https:\\/\\/cdn.example\\/720.mp4' },
    ]
    expect(endpointRendition(json)).toBe('https://cdn.example/1080.mp4')
  })

  it('rejects a non-list response', () => {
    expect(endpointRendition({ videoUrl: 'x' })).toBeNull()
  })
})

describe('embedMp4', () => {
  it('reads the high-quality player call', () => {
    const html = `<script>
      html5player.setVideoUrlLow('https://cdn.example/sd.mp4?secure=a');
      html5player.setVideoUrlHigh('https://cdn.example/hd.mp4?secure=b');
    </script>`
    expect(embedMp4(html)).toBe('https://cdn.example/hd.mp4?secure=b')
  })

  it('falls back to the low rendition', () => {
    const html = `html5player.setVideoUrlLow('https://cdn.example/sd.mp4')`
    expect(embedMp4(html)).toBe('https://cdn.example/sd.mp4')
  })
})

describe('configMp4', () => {
  it('reads the escaped per-quality config and picks the largest', () => {
    const html = `<script>window.initials={"sources":{"240p":"https:\\/\\/video7.xhcdn.com\\/key=1,end=2\\/data=1.2.3.4-dvp\\/030\\/067\\/145\\/240p.h264.mp4","720p":"https:\\/\\/video7.xhcdn.com\\/key=3,end=4\\/data=1.2.3.4-dvp\\/030\\/067\\/145\\/720p.h264.mp4"}};</script>`
    expect(configMp4(html)).toBe(
      'https://video7.xhcdn.com/key=3,end=4/data=1.2.3.4-dvp/030/067/145/720p.h264.mp4',
    )
  })

  it('ignores preview clips and manifests', () => {
    const html = `"preview":"https:\\/\\/thumb.xhcdn.com\\/preview.mp4","hls":"https:\\/\\/video.xhcdn.com\\/master.m3u8"`
    expect(configMp4(html)).toBeNull()
  })
})

describe('resolveVideoSite', () => {
  it('declines every host it does not know', async () => {
    const page = async () => '<html></html>'
    await expect(
      resolveVideoSite(
        'https://example.com/video-1/',
        { direct: page, relay: page },
        'UA',
      ),
    ).resolves.toBeNull()
  })

  it('does not fetch a page it cannot identify', async () => {
    let fetched = 0
    const page = async () => {
      fetched++
      return '<html></html>'
    }
    await resolveVideoSite('https://example.com/', { direct: page, relay: page }, 'UA')
    expect(fetched).toBe(0)
  })

  it('reads the relay when the direct page has no media', async () => {
    const direct = async () => '<html><body>challenge</body></html>'
    const relay = async () =>
      `<script>html5player.setVideoUrlHigh('https://cdn.example/hd.mp4')</script>`
    const result = await resolveVideoSite(
      'https://www.xvideos.com/video.abc123/1/clip',
      { direct, relay },
      'UA',
    )
    expect(result?.mediaUrl).toBe('https://cdn.example/hd.mp4')
  })
})

describe('generic inline scan', () => {
  it('now sees a URL in escaped player config', () => {
    const html = `<script>var config = {"file":"https:\\/\\/cdn.example\\/key=1\\/clip-720p.mp4"};</script>`
    expect(extractMediaFromHtml(html, 'https://site.example/watch/1')?.mediaUrl).toBe(
      'https://cdn.example/key=1/clip-720p.mp4',
    )
  })
})
