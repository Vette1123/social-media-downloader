import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader } from './downloader'

/**
 * A Cobalt tunnel is a promise, not a file: Cobalt answers `status: "tunnel"`
 * at once and only fetches TikTok when the tunnel is read. On 2026-11-19 the
 * daily probe's TikTok tunnel answered `500` after 6.4 s on every read, yet the
 * resolve kept winning the tikwm/Cobalt race in a fraction of a second and the
 * dead tunnel sat in the resolve cache for its whole TTL. The Cobalt leg now
 * reads the first bytes before it counts as an answer.
 */

interface Result {
  downloadUrl: string
  musicUrl?: string
  isPhotoCarousel?: boolean
  sizeBytes?: number
}

type PrivateDownloader = {
  tryTikTokCobalt(url: string): Promise<Result | null>
  tryCobaltInstances(url: string): Promise<Result | null>
  fetchTikTokMeta(url: string): Promise<Record<string, string>>
  probeStream(url: string, opts?: unknown): Promise<{ verdict: string; sizeBytes?: number }>
}

const LINK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const TUNNEL = 'https://cobalt.example/tunnel?id=abc'

function setup(verdict: 'ok' | 'unreachable' | 'wrong-type', result: Result) {
  const d = new Downloader() as unknown as PrivateDownloader
  Object.assign(result, { title: 'tiktok_scout2015_6718335390845095173' })
  vi.spyOn(d, 'tryCobaltInstances').mockResolvedValue(result)
  vi.spyOn(d, 'fetchTikTokMeta').mockResolvedValue({})
  const probe = vi.spyOn(d, 'probeStream').mockResolvedValue({ verdict, sizeBytes: 1234 })
  return { d, probe }
}

afterEach(() => vi.restoreAllMocks())

describe('TikTok via Cobalt only counts a tunnel that streams', () => {
  it('drops a tunnel that does not serve bytes, so the race waits for tikwm', async () => {
    const { d, probe } = setup('unreachable', { downloadUrl: TUNNEL })
    expect(await d.tryTikTokCobalt(LINK)).toBeNull()
    expect(probe).toHaveBeenCalledWith(TUNNEL, { expect: 'video' })
  })

  it('keeps a live tunnel and records its size', async () => {
    const { d } = setup('ok', { downloadUrl: TUNNEL })
    const result = await d.tryTikTokCobalt(LINK)
    expect(result?.downloadUrl).toBe(TUNNEL)
    expect(result?.sizeBytes).toBe(1234)
  })

  it('checks the audio tunnel when that is all there is', async () => {
    const { d, probe } = setup('unreachable', { downloadUrl: '', musicUrl: TUNNEL })
    expect(await d.tryTikTokCobalt(LINK)).toBeNull()
    expect(probe).toHaveBeenCalledWith(TUNNEL, undefined)
  })

  it('does not probe a photo carousel, which has no single stream', async () => {
    const { d, probe } = setup('unreachable', { downloadUrl: '', isPhotoCarousel: true })
    expect(await d.tryTikTokCobalt(LINK)).not.toBeNull()
    expect(probe).not.toHaveBeenCalled()
  })
})

/**
 * Measured 2026-11-19: co.otomir23.me hands back a dead TikTok tunnel about one
 * resolve in six (500 after 6.35 s on the first read); asking again gets a
 * fresh tunnel that streams at once. Probing that one dead tunnel failed 3 of
 * 10 uncached resolves at exactly 6.5 s. A second resolve now starts as soon
 * as the first tunnel fails, or once it has stalled past the hedge.
 */
describe('a dead or stalled Cobalt tunnel gets a second, fresh resolve', () => {
  const FRESH = 'https://cobalt.example/tunnel?id=fresh'

  function twoTunnels(firstProbe: Promise<{ verdict: string }>) {
    const d = new Downloader() as unknown as PrivateDownloader
    const tunnel = (downloadUrl: string) => ({
      downloadUrl,
      title: 'tiktok_scout2015_6718335390845095173',
    })
    const resolves = vi
      .spyOn(d, 'tryCobaltInstances')
      .mockResolvedValueOnce(tunnel(TUNNEL))
      .mockResolvedValueOnce(tunnel(FRESH))
    vi.spyOn(d, 'fetchTikTokMeta').mockResolvedValue({})
    vi.spyOn(d, 'probeStream').mockImplementation(async (url: string) =>
      url === TUNNEL ? firstProbe : { verdict: 'ok' },
    )
    return { d, resolves }
  }

  it('re-resolves at once when the first tunnel is dead', async () => {
    const { d, resolves } = twoTunnels(Promise.resolve({ verdict: 'unreachable' }))
    expect((await d.tryTikTokCobalt(LINK))?.downloadUrl).toBe(FRESH)
    expect(resolves).toHaveBeenCalledTimes(2)
  })

  it('does not wait out a stalled first tunnel', async () => {
    const { d } = twoTunnels(new Promise(() => {}))
    const started = Date.now()
    expect((await d.tryTikTokCobalt(LINK))?.downloadUrl).toBe(FRESH)
    expect(Date.now() - started).toBeLessThan(2500)
  })

  it('costs one resolve when the first tunnel streams', async () => {
    const { d, resolves } = twoTunnels(Promise.resolve({ verdict: 'ok' }))
    expect((await d.tryTikTokCobalt(LINK))?.downloadUrl).toBe(TUNNEL)
    await new Promise((r) => setTimeout(r, 1700))
    expect(resolves).toHaveBeenCalledTimes(1)
  })
})
