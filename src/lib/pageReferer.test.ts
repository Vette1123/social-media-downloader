import { afterEach, describe, expect, it, vi } from 'vitest'
import { toMediaUrl, toRawMediaUrl } from './apiRoutes'
import { upstreamHeaders } from './mediaProxy'
import { fetchWithNodeFallback, isCloudflareChallenge } from './upstreamFetch'

describe('page referer through the media proxy', () => {
  it('carries a generic page origin as ref when the CDN has no referer of its own', () => {
    const url = toMediaUrl('https://cdn.other.test/v.mp4', '/api/video', 'https://site.test/watch/1?x=2')
    expect(url).toBe(
      `/api/video?url=${encodeURIComponent('https://cdn.other.test/v.mp4')}&ref=${encodeURIComponent('https://site.test/')}`,
    )
    const params = new URL(url, 'http://local').searchParams
    expect(upstreamHeaders(params.get('url')!, '*/*', undefined, params.get('ref')).Referer).toBe(
      'https://site.test/',
    )
  })

  it('adds no ref for a known platform CDN or without a page', () => {
    expect(toMediaUrl('https://video.twimg.com/v.mp4', '/api/video', 'https://site.test/')).not.toContain('ref=')
    expect(toMediaUrl('https://cdn.other.test/v.mp4', '/api/video')).not.toContain('ref=')
    expect(toMediaUrl('/api/tunnel?id=1', '/api/video', 'https://site.test/')).toBe('/api/tunnel?id=1')
  })

  it('a known CDN keeps its own referer over ref, and a hostile ref is reduced to an origin', () => {
    expect(upstreamHeaders('https://video.twimg.com/v.mp4', '*/*', undefined, 'https://site.test/').Referer).toBe(
      'https://x.com/',
    )
    expect(
      upstreamHeaders('https://cdn.other.test/v.mp4', '*/*', undefined, 'https://site.test/a\r\nX-Evil: 1').Referer,
    ).toBe('https://site.test/')
    expect(upstreamHeaders('https://cdn.other.test/v.mp4', '*/*', undefined, 'javascript:1').Referer).toBeUndefined()
  })

  it('unwraps a proxy URL back to the raw media URL even with ref after it', () => {
    const raw = 'https://cdn.other.test/v.mp4?a=1&b=2'
    expect(toRawMediaUrl(toMediaUrl(raw, '/api/video', 'https://site.test/'))).toBe(raw)
    expect(toRawMediaUrl('https://already.raw/x.jpg')).toBe('https://already.raw/x.jpg')
  })
})

describe('fetchWithNodeFallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('only treats a 403 carrying cf-mitigated: challenge as a challenge', () => {
    expect(isCloudflareChallenge(new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } }))).toBe(true)
    expect(isCloudflareChallenge(new Response(null, { status: 403 }))).toBe(false)
    expect(isCloudflareChallenge(new Response(null, { status: 200, headers: { 'cf-mitigated': 'challenge' } }))).toBe(false)
  })

  it('returns fetch untouched for a plain 403 and on Cloudflare, making no second request', async () => {
    const plain = new Response(null, { status: 403 })
    const fetchMock = vi.fn(async () => plain)
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchWithNodeFallback('https://cdn.other.test/v.mp4')).toBe(plain)

    vi.stubEnv('DEPLOY_TARGET', 'cloudflare')
    const challenge = new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } })
    fetchMock.mockImplementation(async () => challenge)
    expect(await fetchWithNodeFallback('https://cdn.other.test/v.mp4')).toBe(challenge)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
