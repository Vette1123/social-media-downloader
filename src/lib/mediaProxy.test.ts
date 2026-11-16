import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAudioProxy, handleImageProxy, handleVideoProxy } from './mediaProxy'

const ask = (handler: (r: Request) => Promise<Response>) =>
  handler(new Request('https://x.space/api/x?url=' + encodeURIComponent('https://cdn.test/f')))

const upstream = (...answers: (number | Error)[]) => {
  const fetchMock = vi.fn(async () => {
    const next = answers.shift()!
    if (next instanceof Error) throw next
    return new Response(next < 400 ? 'bytes' : 'no', {
      status: next,
      headers: { 'content-type': 'application/octet-stream' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe.each([
  ['audio', handleAudioProxy],
  ['video', handleVideoProxy],
  ['image', handleImageProxy],
])('%s proxy when the upstream host refuses', (_name, handler) => {
  it('passes an expired-link 403 through instead of turning it into our 500', async () => {
    const fetchMock = upstream(403)
    expect((await ask(handler)).status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers 502 for an upstream 530, after one retry', async () => {
    const fetchMock = upstream(530, 530)
    expect((await ask(handler)).status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('answers 502 when the upstream connection drops', async () => {
    upstream(new Error('connection reset'), new Error('connection reset'))
    expect((await ask(handler)).status).toBe(502)
  })

  it('recovers when the retry succeeds', async () => {
    upstream(503, 200)
    expect((await ask(handler)).status).toBe(200)
  })
})

describe.each([
  ['audio', handleAudioProxy],
  ['video', handleVideoProxy],
])('%s proxy reopening a seek', (_name, handler) => {
  it('answers 502, not 500, when the reopened request drops', async () => {
    // A closed range on an upstream that omits Content-Range makes the proxy
    // re-ask from the seek point. That second fetch dropping was the last way
    // left to reach the catch-all 500 (PostHog worker:/api/audio:500).
    const answers: (Response | Error)[] = [
      new Response('bytes', { status: 206 }),
      new Error('connection reset'),
      new Error('connection reset'),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const next = answers.shift()!
        if (next instanceof Error) throw next
        return next
      }),
    )
    const res = await handler(
      new Request('https://x.space/api/x?url=' + encodeURIComponent('https://cdn.test/f'), {
        headers: { Range: 'bytes=10-20' },
      }),
    )
    expect(res.status).toBe(502)
  })
})

describe('image proxy serving our own origin', () => {
  const answer = (type: string) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<script>alert(1)</script>', { headers: { 'content-type': type } })))

  // /api/image?url=<any page> used to answer 200 text/html: anyone's markup
  // and script, rendered on socialdownloader.space.
  it.each(['text/html; charset=utf-8', 'text/plain', 'application/javascript', 'application/xhtml+xml'])(
    'refuses a %s upstream with 415',
    async (type) => {
      answer(type)
      const res = await ask(handleImageProxy)
      expect(res.status).toBe(415)
      expect(res.headers.get('content-type')).toMatch(/json/)
    },
  )

  it.each(['image/jpeg', 'image/webp', 'image/svg+xml', 'application/octet-stream', 'binary/octet-stream'])(
    'streams a %s upstream, sandboxed so an SVG cannot run script',
    async (type) => {
      answer(type)
      const res = await ask(handleImageProxy)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toMatch(/sandbox/)
    },
  )
})

describe.each([
  ['audio', handleAudioProxy],
  ['video', handleVideoProxy],
  ['image', handleImageProxy],
])('%s proxy given a URL that is not http(s)', (_name, handler) => {
  it('answers 400 without fetching it', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await handler(new Request('https://x.space/api/x?url=' + encodeURIComponent('file:///etc/passwd')))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
