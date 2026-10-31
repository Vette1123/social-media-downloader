import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader, facebookReelFromPage } from './downloader'

/**
 * Some public reels are walled for logged-out visitors, so the plugin, the
 * crawler and Cobalt all come back empty. The page a session sees lists a muxed
 * MP4 per quality, and a reel page also carries the reels queued after it.
 * Everything here pins one of two things: the requested reel is the one
 * returned, and the cookie reaches only `www.facebook.com`, only for a
 * credentialed instance.
 */
const REEL = '2582177208918717'
const NEXT_REEL = '1739775020461063'
const CDN = 'https:\\/\\/video.example.fbcdn.net\\/o1\\/v\\/t2'

const details = (tag: string) =>
  `"preferred_thumbnail":{"image":{"uri":"https:\\/\\/scontent.example.fbcdn.net\\/v\\/t15.5256-10\\/${tag}.jpg?a=1"}},` +
  `"playable_duration_in_ms":17853,"owner":{"__typename":"User","id":"615"}`

/** The page puts these far past every list, tied to the reel only by its id. */
const story = (id: string, tag: string) =>
  `"owner":{"__typename":"User","__isActor":"User","id":"615","name":"${tag} owner","is_verified":false,"url":"x"},"woodhenge_creator_info":null}},"id":"${id}","video_owner_type":"x"},` +
  `${'"pad":1,'.repeat(800)}` +
  `"message":{"text":"${tag} caption \\ud83d\\udda4","ranges":[]}`

const block = (id: string, tag: string) =>
  `"progressive_urls":[` +
  `{"progressive_url":"${CDN}\\/${tag}-sd.mp4?a=1&b=2","failure_reason":null,"metadata":{"quality":"SD"}},` +
  `{"progressive_url":"${CDN}\\/${tag}-hd.mp4?a=1&b=2","failure_reason":null,"metadata":{"quality":"HD"}}` +
  `],"hls_playlist_urls":[]}},"id":"${id}","owner":{"id":"61589208197179"},${details(tag)}`

const PAGE = `<html><title>Facebook</title>${block(NEXT_REEL, 'next')}${block(REEL, 'wanted')}${story(NEXT_REEL, 'next')}${story(REEL, 'wanted')}</html>`

describe('facebookReelFromPage', () => {
  it('returns the HD file of the requested reel, not the next one in the feed', () => {
    expect(facebookReelFromPage(PAGE, REEL)?.downloadUrl).toBe(
      'https://video.example.fbcdn.net/o1/v/t2/wanted-hd.mp4?a=1&b=2',
    )
  })

  it('reads the poster, caption, owner and length of that reel only', () => {
    expect(facebookReelFromPage(PAGE, REEL)).toMatchObject({
      thumbnail: 'https://scontent.example.fbcdn.net/v/t15.5256-10/wanted.jpg?a=1',
      caption: 'wanted caption 🖤',
      author: 'wanted owner',
      duration: 18,
    })
    expect(facebookReelFromPage(PAGE, NEXT_REEL)).toMatchObject({
      thumbnail: 'https://scontent.example.fbcdn.net/v/t15.5256-10/next.jpg?a=1',
      caption: 'next caption 🖤',
    })
  })

  it('still returns the file when the details are missing', () => {
    const page = `"progressive_urls":[{"progressive_url":"${CDN}\\/bare.mp4","metadata":{"quality":"HD"}}],"id":"${REEL}"`
    expect(facebookReelFromPage(page, REEL)).toEqual({
      downloadUrl: 'https://video.example.fbcdn.net/o1/v/t2/bare.mp4',
      thumbnail: '',
      caption: '',
      author: '',
      duration: 0,
    })
  })

  it('falls back to SD when HD is missing', () => {
    const page = `"progressive_urls":[{"progressive_url":"${CDN}\\/only-sd.mp4","failure_reason":null,"metadata":{"quality":"SD"}}],"id":"${REEL}"`
    expect(facebookReelFromPage(page, REEL)?.downloadUrl).toBe(
      'https://video.example.fbcdn.net/o1/v/t2/only-sd.mp4',
    )
  })

  it('returns nothing when the page does not hold that reel', () => {
    expect(facebookReelFromPage(PAGE, '999')).toBeNull()
    expect(facebookReelFromPage('<html>login</html>', REEL)).toBeNull()
  })
})

describe('the Facebook session route', () => {
  type WithSession = {
    tryFacebookSession(
      resolvedUrl: string,
      originalUrl: string,
    ): Promise<{
      downloadUrl?: string
      id: string
      title: string
      author: string
      thumbnail: string
      duration: number
    } | null>
  }
  const session = (d: Downloader) => d as unknown as WithSession
  const resolved = `https://www.facebook.com/reel/${REEL}/?rdid=abc&share_url=x`

  const stubPage = () =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(PAGE, { status: 200 }))

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('sends the cookie to the canonical page and returns the reel', async () => {
    vi.stubEnv('FB_COOKIE', 'c_user=1; xs=2')
    const spy = stubPage()
    const result = await session(
      new Downloader({ credentialed: true }),
    ).tryFacebookSession(resolved, 'https://www.facebook.com/share/r/x/')

    expect(String(spy.mock.calls[0][0])).toBe(
      `https://www.facebook.com/reel/${REEL}/`,
    )
    const headers = spy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Cookie).toBe('c_user=1; xs=2')
    expect(result).toMatchObject({
      title: 'wanted caption 🖤',
      author: 'wanted owner',
      duration: 18,
    })
    expect(result?.thumbnail).toContain('wanted.jpg')
    expect(result?.downloadUrl).toContain('wanted-hd.mp4')
  })

  it('never makes the request for an anonymous visitor', async () => {
    vi.stubEnv('FB_COOKIE', 'c_user=1; xs=2')
    const spy = stubPage()
    const result = await session(new Downloader()).tryFacebookSession(
      resolved,
      resolved,
    )
    expect(result).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('does nothing when no cookie is configured', async () => {
    vi.stubEnv('FB_COOKIE', '')
    const spy = stubPage()
    const result = await session(
      new Downloader({ credentialed: true }),
    ).tryFacebookSession(resolved, resolved)
    expect(result).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('takes the id from the link and ignores the host it arrived on', async () => {
    vi.stubEnv('FB_COOKIE', 'c_user=1; xs=2')
    const spy = stubPage()
    await session(new Downloader({ credentialed: true })).tryFacebookSession(
      `https://facebook.com.evil.example/reel/${REEL}/`,
      resolved,
    )
    expect(new URL(String(spy.mock.calls[0][0])).host).toBe('www.facebook.com')
  })
})
