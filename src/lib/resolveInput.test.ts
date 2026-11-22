import { afterEach, describe, expect, it, vi } from 'vitest'

const trackRejected = vi.hoisted(() => vi.fn())
vi.mock('./tikwmClient', () => ({ resolveTikTokInBrowser: vi.fn() }))
vi.mock('./analytics', async (orig) => ({
  ...(await orig<typeof import('./analytics')>()),
  trackLinkRejected: trackRejected,
}))

const { resolve } = await import('./resolve')

afterEach(() => {
  vi.unstubAllGlobals()
  trackRejected.mockReset()
})

const answer = (title: string) => ({
  success: true as const,
  downloadUrl: '/api/video',
  audioUrl: '',
  metadata: { title },
})

describe('text that is not a link', () => {
  it('is refused with no request and reports not_a_url', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    const result = await resolve('hello there friend')
    expect(result.success).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    expect(trackRejected).toHaveBeenCalledWith(expect.objectContaining({ reason: 'not_a_url' }))
  })
})

describe('the one silent retry', () => {
  /** A give-up that a second run routinely turns into a success. */
  const giveUp = () =>
    new Response(JSON.stringify({ success: false, error: 'This account is private' }))

  it.each([
    ['instagram', 'https://www.instagram.com/reel/Cabc123/'],
    ['facebook', 'https://www.facebook.com/reel/1234567890'],
    ['twitter', 'https://x.com/someone/status/1234567890'],
  ])('asks %s once more after a give-up', async (_name, url) => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(giveUp())
      .mockResolvedValueOnce(new Response(JSON.stringify(answer('second'))))
    vi.stubGlobal('fetch', spy)
    const result = await resolve(url)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(result.metadata?.title).toBe('second')
  })

  it('does not re-ask a platform that gets no retry', async () => {
    const spy = vi.fn().mockImplementation(async () => giveUp())
    vi.stubGlobal('fetch', spy)
    await resolve('https://www.pinterest.com/pin/123456/')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
