import { describe, expect, it } from 'vitest'
import { getMediaReferer, pageOriginReferer } from './proxyHeaders'

describe('pageOriginReferer', () => {
  it('names the page origin, never its path, query or credentials', () => {
    expect(pageOriginReferer('https://www.site.test/watch/123/title/?t=4')).toBe(
      'https://www.site.test/',
    )
    expect(pageOriginReferer('http://site.test:8080/a')).toBe('http://site.test:8080/')
    expect(pageOriginReferer('https://user:pw@site.test/a')).toBe('https://site.test/')
  })

  it('is empty for anything that is not an http(s) URL', () => {
    for (const value of [undefined, null, '', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd']) {
      expect(pageOriginReferer(value)).toBe('')
    }
  })
})

describe('getMediaReferer', () => {
  it('returns site origin for known main-social CDNs', () => {
    expect(getMediaReferer('https://i.ytimg.com/x.jpg')).toBe(
      'https://www.youtube.com/',
    )
    expect(getMediaReferer('https://video.twimg.com/x.mp4')).toBe('https://x.com/')
  })

  it('returns empty string for cobalt tunnels and unknown hosts', () => {
    expect(getMediaReferer('https://cobalt.example/tunnel/abc')).toBe('')
    expect(getMediaReferer('https://cdn.unknown-site.test/v.mp4')).toBe('')
  })
})
