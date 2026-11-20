import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The paste path for a TikTok link runs two resolvers: the browser's own call to
 * tikwm, and POST /api/download. tikwm is the better answer when it is quick —
 * its CDN URL streams straight to the visitor — but it queues its callers under
 * load, and awaiting it outright made every paste wait out that queue before the
 * server was asked at all. These pin the hedge that replaced it.
 */
const browserResolve = vi.hoisted(() => vi.fn())
vi.mock('./tikwmClient', () => ({ resolveTikTokInBrowser: browserResolve }))

const { resolve } = await import('./resolve')

const TIKTOK = 'https://www.tiktok.com/@someone/video/7123456789012345678'

/** What each resolver hands back, distinguishable by title. */
const answer = (title: string) => ({
  success: true as const,
  downloadUrl: `/api/video?url=${title}`,
  audioUrl: '',
  metadata: { title } as never,
})

function stubServer(delayMs: number, title = 'from-server') {
  const spy = vi.fn(
    async () =>
      new Promise<Response>((r) =>
        setTimeout(
          () => r(new Response(JSON.stringify(answer(title)))),
          delayMs,
        ),
      ),
  )
  vi.stubGlobal('fetch', spy)
  return spy
}

const never = new Promise<never>(() => {})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  browserResolve.mockReset()
})

describe('resolving a TikTok link', () => {
  it('never troubles the server when the browser answers first', async () => {
    browserResolve.mockResolvedValue(answer('from-browser'))
    const server = stubServer(0)

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-browser')
    expect(server).not.toHaveBeenCalled()
  })

  it('falls to the server the moment the browser attempt misses', async () => {
    browserResolve.mockResolvedValue(null)
    stubServer(0)

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-server')
  })

  it('does not wait out a queueing tikwm', async () => {
    // The failure this replaced: the browser call sat on tikwm's queue and the
    // server was not asked until it gave up.
    browserResolve.mockReturnValue(never)
    stubServer(0)

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-server')
  })

  it('asks the server at once instead of giving tikwm a head start', async () => {
    // Measured 2026-11-19: tikwm answered in 2.2–5.6 s on 9 of 9 calls, so a
    // 700 ms head start never let it win and only delayed every paste.
    browserResolve.mockReturnValue(never)
    const server = stubServer(10_000)

    void resolve(TIKTOK)
    await new Promise((r) => setTimeout(r, 50))

    expect(server).toHaveBeenCalled()
  })

  it('keeps a late browser answer when the server request fails', async () => {
    // Racing the raw server promise meant a network error settled the race and
    // was thrown at the caller, discarding the browser answer still in flight.
    browserResolve.mockReturnValue(
      new Promise((r) => setTimeout(() => r(answer('from-browser')), 750)),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-browser')
  })

  it('keeps a late browser answer when the server answers with a failure', async () => {
    // A server JSON `{success:false}` (the 422 "Failed to extract") is truthy,
    // so it settled the race as the answer while tikwm was still queueing.
    browserResolve.mockReturnValue(
      new Promise((r) => setTimeout(() => r(answer('from-browser')), 750)),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Failed to extract' }))),
    )

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-browser')
  })

  it("hands back the server's failure when the browser has nothing either", async () => {
    browserResolve.mockResolvedValue(null)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Failed to extract' }))),
    )

    const result = await resolve(TIKTOK)

    expect(result.success).toBe(false)
  })

  it('cancels the server request the browser beat', async () => {
    browserResolve.mockReturnValue(
      new Promise((r) => setTimeout(() => r(answer('from-browser')), 750)),
    )
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined
        return never
      }),
    )

    const result = await resolve(TIKTOK)

    expect(result.metadata?.title).toBe('from-browser')
    expect(signal?.aborted).toBe(true)
  })

  it('leaves audio mode on the server path, which tikwm cannot serve', async () => {
    stubServer(0)
    await resolve(TIKTOK, { format: 'audio' })
    expect(browserResolve).not.toHaveBeenCalled()
  })

  it('leaves every other platform on the server path', async () => {
    stubServer(0)
    await resolve('https://www.instagram.com/reel/Cabcdefghij/')
    expect(browserResolve).not.toHaveBeenCalled()
  })
})

describe('resolving an Instagram link', () => {
  const REEL = 'https://www.instagram.com/reel/DKcalTzoftf/?igsh=abc'
  const GIVE_UP =
    'Could not download this Instagram post. Public posts, reels and carousels work — this one is private, age- or region-restricted, or has been deleted, and Instagram serves those only to a logged-in account.'

  const stubSequence = (...bodies: object[]) => {
    const spy = vi.fn()
    bodies.forEach((b) =>
      spy.mockResolvedValueOnce(new Response(JSON.stringify(b))),
    )
    vi.stubGlobal('fetch', spy)
    return spy
  }

  it('asks again silently when the first run gives up, so one click is enough', async () => {
    const spy = stubSequence({ success: false, error: GIVE_UP }, answer('second'))

    const result = await resolve(REEL)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    expect(result.metadata?.title).toBe('second')
  })

  it('stops after the second run, whatever it says', async () => {
    const spy = stubSequence(
      { success: false, error: GIVE_UP },
      { success: false, error: GIVE_UP },
    )

    const result = await resolve(REEL)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(false)
  })

  it('does not re-run a story link, which only a session can open', async () => {
    const spy = stubSequence({
      success: false,
      error: 'Instagram only serves these to a logged-in account',
    })

    await resolve('https://www.instagram.com/stories/someone/123456/')

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not re-run another platform’s failure', async () => {
    const spy = stubSequence({ success: false, error: GIVE_UP })

    await resolve('https://www.facebook.com/reel/123456789')

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
