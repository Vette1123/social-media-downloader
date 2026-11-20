import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader, isTikTokShortLink } from './downloader'

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

afterEach(() => vi.restoreAllMocks())

describe('TikTok short links', () => {
  it('names the three short shapes', () => {
    expect(isTikTokShortLink('https://vt.tiktok.com/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://vm.tiktok.com/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://www.tiktok.com/t/ZSabc')).toBe(true)
    expect(isTikTokShortLink('https://www.tiktok.com/@a/video/1')).toBe(false)
  })

  it('says a retired code is retired, not that TikTok is blocking us', async () => {
    const d = setup('https://www.tiktok.com/?_r=1')
    await expect(d.downloadVideo('https://vt.tiktok.com/ZSdead')).rejects.toThrow(/no longer points to a post/)
  })

  it('retries on the post a live code lands on', async () => {
    const d = setup('https://www.tiktok.com/@/photo/7584709238878915858?_r=1')
    const spy = vi.spyOn(d, 'downloadVideo')
    await d.downloadVideo('https://www.tiktok.com/t/ZSlive').catch(() => undefined)
    expect(spy).toHaveBeenCalledWith('https://www.tiktok.com/@/photo/7584709238878915858?_r=1', true)
  })
})
