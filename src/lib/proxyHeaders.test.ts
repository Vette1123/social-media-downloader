import { describe, expect, it } from 'vitest'
import { getMediaReferer } from './proxyHeaders'

describe('getMediaReferer', () => {
  it('returns site origin for known main-social CDNs', () => {
    expect(getMediaReferer('https://i.ytimg.com/x.jpg')).toBe(
      'https://www.youtube.com/',
    )
    expect(getMediaReferer('https://video.twimg.com/x.mp4')).toBe('https://x.com/')
  })

  it('returns the site origin for phncdn media', () => {
    expect(
      getMediaReferer('https://ev.phncdn.com/videos/123/720P.mp4?validfrom=1'),
    ).toBe('https://www.pornhub.com/')
    expect(getMediaReferer('https://www.pornhub.com/viewkey=x')).toBe(
      'https://www.pornhub.com/',
    )
  })

  it('returns the site origin for xhcdn / xhpingcdn media', () => {
    expect(getMediaReferer('https://video-h.xhcdn.com/abc.mp4')).toBe(
      'https://www.xhamster.com/',
    )
    expect(getMediaReferer('https://xhcdn.com/a/b.webm')).toBe(
      'https://www.xhamster.com/',
    )
    expect(getMediaReferer('https://www.xhamster.com/videos/x')).toBe(
      'https://www.xhamster.com/',
    )
  })

  it('returns the site origin for its own CDN hosts', () => {
    expect(getMediaReferer('https://www.eporner.com/embed/x')).toBe(
      'https://www.eporner.com/',
    )
    expect(getMediaReferer('https://f1.eporner.com/dl/x.mp4')).toBe(
      'https://www.eporner.com/',
    )
    expect(getMediaReferer('https://eporner.com/download/x')).toBe(
      'https://www.eporner.com/',
    )
  })

  it('returns other site origins for their CDN hosts', () => {
    expect(getMediaReferer('https://rt10.redtube.com/v.mp4')).toBe(
      'https://www.redtube.com/',
    )
    expect(getMediaReferer('https://cdn.youporn.com/v.mp4')).toBe(
      'https://www.youporn.com/',
    )
    expect(getMediaReferer('https://img.tube8cdn.com/v.mp4')).toBe(
      'https://www.tube8.com/',
    )
    expect(getMediaReferer('https://sbcdn.spankbang.com/v.mp4')).toBe(
      'https://www.spankbang.com/',
    )
    expect(getMediaReferer('https://cdn100.xvideos.com/v.mp4')).toBe(
      'https://www.xvideos.com/',
    )
    expect(getMediaReferer('https://cdn-xnxx.xnxx.com/v.mp4')).toBe(
      'https://www.xnxx.com/',
    )
    expect(getMediaReferer('https://cdn.motherless.com/v.mp4')).toBe(
      'https://motherless.com/',
    )
  })

  it('returns empty string for cobalt tunnels and unknown hosts', () => {
    expect(getMediaReferer('https://cobalt.example/tunnel/abc')).toBe('')
    expect(getMediaReferer('https://cdn.unknown-site.test/v.mp4')).toBe('')
  })
})
