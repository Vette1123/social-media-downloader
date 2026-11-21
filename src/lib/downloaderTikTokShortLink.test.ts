import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader, isTikTokHomePage, isTikTokShortLink } from './downloader'

/**
 * A TikTok short link that tikwm and Cobalt could not read used to end at "All
 * download methods failed. TikTok might be blocking requests", although most of
 * them are simply dead: TikTok answers a retired code with a 302 to its home
 * page. A link that still lands on a post is retried on that post.
 */

type Private = {
  tryTikwmMethod(u: string): Promise<null>
  tryTikTokCobalt(u: string): Promise<null>
  tryYtDlpTikTok(u: string): Promise<null>
  trySnaptikMethod(u: string): Promise<null>
  trySSSMethod(u: string): Promise<null>
  tryDirectTikTokScraping(u: string): Promise<null>
  resolveRedirect(u: string): Promise<string>
}

function setup(landing: string) {
  const d = new Downloader() as unknown as Private
  for (const m of [
    'tryTikwmMethod',
    'tryTikTokCobalt',
    'tryYtDlpTikTok',
    'trySnaptikMethod',
    'trySSSMethod',
    'tryDirectTikTokScraping',
  ] as const) {
    vi.spyOn(d, m).mockResolvedValue(null)
  }
  vi.spyOn(d, 'resolveRedirect').mockResolvedValue(landing)
  return d as unknown as Downloader
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TikTok short links', () => {
  it('names the three short shapes', () => {
    expect(isTikTokShortLink('https://vt.tiktok.com/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://vm.tiktok.com/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://www.tiktok.com/t/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://www.tiktok.com/@a/video/1')).toBe(false)
  })

  it('says a retired code is retired, not that TikTok is blocking us', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const d = setup('https://www.tiktok.com/?_r=1')
    await expect(d.downloadVideo('https://vt.tiktok.com/ZSdead')).rejects.toThrow(/no longer points to a post/)
  })

  it('retries on the post a live code lands on', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const d = setup('https://www.tiktok.com/@/photo/7584709238878915858?_r=1')
    const spy = vi.spyOn(d, 'downloadVideo')
    await d.downloadVideo('https://www.tiktok.com/t/ZSlive').catch(() => undefined)
    expect(spy).toHaveBeenCalledWith('https://www.tiktok.com/@/photo/7584709238878915858?_r=1', true)
  })
})

/**
 * 2026-11-21: vt|/* and www|/t/* codes ended "inconclusive". The expansion ran
 * only after every extractor had missed, and followed the redirect into the
 * whole video page; from the Worker that page is challenged or times out, the
 * walk returned the unchanged short link and the code looked unreadable. The
 * code is now read from its own 302, first, and never fetches the page.
 */
describe('TikTok short link expansion reads only the 302', () => {
  const LIVE =
    'https://www.tiktok.com/@/video/7574301384833617172?_r=1&u_code=x&share_item_id=7574301384833617172'

  function stubFetch(location: string) {
    const fetchMock = vi.fn(async (_u: string, init?: { redirect?: string }) => {
      // The page behind the 302 never answers, as from a datacenter IP.
      if (init?.redirect !== 'manual') throw new Error('page fetched')
      return new Response(null, { status: 302, headers: { location } })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  afterEach(() => vi.unstubAllGlobals())

  it('goes to the post before any extractor runs, tracking query dropped', async () => {
    stubFetch(LIVE)
    const d = setup('https://www.tiktok.com/?_r=1')
    const real = d.downloadVideo.bind(d)
    const spy = vi
      .spyOn(d, 'downloadVideo')
      .mockImplementation((u, expanded) => (expanded ? Promise.reject(new Error('stop')) : real(u, expanded)))
    await d.downloadVideo('https://vt.tiktok.com/ZSlive/').catch(() => undefined)
    expect(spy).toHaveBeenCalledWith('https://www.tiktok.com/@/video/7574301384833617172', true)
  })

  it('calls a retired code retired without asking an extractor', async () => {
    stubFetch('https://www.tiktok.com/?_r=1')
    const d = setup('https://www.tiktok.com/?_r=1')
    await expect(d.downloadVideo('https://www.tiktok.com/t/ZSdead/')).rejects.toThrow(/no longer points to a post/)
    expect((d as unknown as Private).tryTikwmMethod).not.toHaveBeenCalled()
  })
})

describe('isTikTokHomePage', () => {
  it.each([
    ['https://www.tiktok.com/', true],
    ['https://www.tiktok.com/?_r=1', true],
    ['https://www.tiktok.com/foryou', true],
    // A login or consent hop is not a verdict on the code: never "retired".
    ['https://www.tiktok.com/login?redirect_url=x', false],
    ['https://m.tiktok.com/v/7574301384833617172.html', false],
    ['not a url', false],
  ])('%s → %s', (url, home) => {
    expect(isTikTokHomePage(url)).toBe(home)
  })
})
