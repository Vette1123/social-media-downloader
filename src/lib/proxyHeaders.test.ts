import { describe, expect, it } from 'vitest'
import { getMediaReferer } from './proxyHeaders'

describe('getMediaReferer', () => {
  it('returns site origin for known main-social CDNs', () => {
    expect(getMediaReferer('https://i.ytimg.com/x.jpg')).toBe(
      'https://www.youtube.com/',
    )
    expect(getMediaReferer('https://video.twimg.com/x.mp4')).toBe('https://x.com/')
  })

  it('returns the site origin for cdna media', () => {
    expect(
      getMediaReferer('https://ev.cdna.com/videos/123/720P.mp4?validfrom=1'),
    ).toBe('https://www.sitea.com/')
    expect(getMediaReferer('https://www.sitea.com/viewkey=x')).toBe(
      'https://www.sitea.com/',
    )
  })

  it('returns the site origin for cdnb / cdnb media', () => {
    expect(getMediaReferer('https://video-h.cdnb.com/abc.mp4')).toBe(
      'https://www.siteb.com/',
    )
    expect(getMediaReferer('https://cdnb.com/a/b.webm')).toBe(
      'https://www.siteb.com/',
    )
    expect(getMediaReferer('https://www.siteb.com/videos/x')).toBe(
      'https://www.siteb.com/',
    )
  })

  it('returns the site origin for its own CDN hosts', () => {
    expect(getMediaReferer('https://www.sitec.com/embed/x')).toBe(
      'https://www.sitec.com/',
    )
    expect(getMediaReferer('https://f1.sitec.com/dl/x.mp4')).toBe(
      'https://www.sitec.com/',
    )
    expect(getMediaReferer('https://sitec.com/download/x')).toBe(
      'https://www.sitec.com/',
    )
  })

  it('returns other site origins for their CDN hosts', () => {
    expect(getMediaReferer('https://rt10.sited.com/v.mp4')).toBe(
      'https://www.sited.com/',
    )
    expect(getMediaReferer('https://cdn.sitee.com/v.mp4')).toBe(
      'https://www.sitee.com/',
    )
    expect(getMediaReferer('https://img.cdnf.com/v.mp4')).toBe(
      'https://www.sitef.com/',
    )
    expect(getMediaReferer('https://cdng.siteg.com/v.mp4')).toBe(
      'https://www.siteg.com/',
    )
    expect(getMediaReferer('https://cdn100.siteh.com/v.mp4')).toBe(
      'https://www.siteh.com/',
    )
    expect(getMediaReferer('https://cdn-sitei.sitei.com/v.mp4')).toBe(
      'https://www.sitei.com/',
    )
    expect(getMediaReferer('https://cdn.sitej.com/v.mp4')).toBe(
      'https://sitej.com/',
    )
  })

  it('returns empty string for cobalt tunnels and unknown hosts', () => {
    expect(getMediaReferer('https://cobalt.example/tunnel/abc')).toBe('')
    expect(getMediaReferer('https://cdn.unknown-site.test/v.mp4')).toBe('')
  })
})
