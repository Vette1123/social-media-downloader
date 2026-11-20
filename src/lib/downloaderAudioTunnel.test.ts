import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader } from './downloader'

// As on the Worker: no yt-dlp, so the MP3 fallback goes straight to the video
// resolve instead of probing a real binary.
vi.mock('./nativeMedia', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./nativeMedia')>()),
  nativeMediaAvailable: () => false,
}))

/**
 * The MP3 button on a long YouTube video (2026-11-18, `JkeyKeK3V24`, 1 h 51 min)
 * got a Cobalt audio tunnel that answered `200` with an empty body: the
 * visitor waited ~15 s and saved nothing. YouTube refuses every path we have
 * for such a video, so the right answer is the "could not extract audio"
 * message at once. The Cobalt leg of the audio path now reads the tunnel's
 * first bytes before it counts.
 */

interface Result {
  title: string
  downloadUrl: string
  musicUrl?: string
}

type PrivateDownloader = {
  downloadAudio(url: string, platform: string): Promise<Result>
  tryCobaltInstances(url: string): Promise<Result | null>
  tryYouTubeInnertubeAudio(url: string, platform: string): Promise<Result | null>
  fallbackAudioViaVideo(url: string): Promise<Result | null>
  fetchYouTubeMeta(): Promise<Record<string, string>>
  probeStream(url: string, opts?: unknown): Promise<{ verdict: string }>
}

const LINK = 'https://www.youtube.com/watch?v=JkeyKeK3V24'
const TUNNEL = 'https://cobalt.example/tunnel?id=a'

function setup(verdict: 'ok' | 'unreachable', fallback: Result | null = null) {
  const d = new Downloader({ mode: 'audio' }) as unknown as PrivateDownloader
  vi.spyOn(d, 'tryCobaltInstances').mockResolvedValue({ title: 'x', downloadUrl: '', musicUrl: TUNNEL })
  vi.spyOn(d, 'tryYouTubeInnertubeAudio').mockResolvedValue(fallback)
  vi.spyOn(d, 'fallbackAudioViaVideo').mockResolvedValue(null)
  vi.spyOn(d, 'fetchYouTubeMeta').mockResolvedValue({})
  const probe = vi.spyOn(d, 'probeStream').mockResolvedValue({ verdict })
  return { d, probe }
}

afterEach(() => vi.restoreAllMocks())

describe('the MP3 path only offers an audio tunnel that streams', () => {
  it('says no audio up front when the only tunnel is empty', async () => {
    const { d, probe } = setup('unreachable')
    await expect(d.downloadAudio(LINK, 'youtube')).rejects.toThrow(/Could not extract audio/)
    expect(probe).toHaveBeenCalledWith(TUNNEL)
  })

  it('moves on to the next audio source when the tunnel is empty', async () => {
    const { d } = setup('unreachable', { title: 'y (audio)', downloadUrl: '', musicUrl: 'https://rr.googlevideo.com/a' })
    expect((await d.downloadAudio(LINK, 'youtube')).musicUrl).toBe('https://rr.googlevideo.com/a')
  })

  it('keeps a tunnel that streams', async () => {
    const { d } = setup('ok')
    expect((await d.downloadAudio(LINK, 'youtube')).musicUrl).toBe(TUNNEL)
  })
})

/**
 * 2026-11-20: every TikTok MP3 failed on prod. Cobalt's TikTok audio tunnel
 * answers `200` with 0 bytes, the probe rightly drops it, and the video
 * fallback then skipped Cobalt as if it had missed the link, which left only
 * tikwm, which never answers from the Worker. Cobalt's VIDEO tunnel for the
 * same post streams, so the fallback must still ask it.
 */
describe('the MP3 video fallback asks Cobalt again unless Cobalt had nothing', () => {
  const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

  async function innerSkipCobalt(cobalt: Result | null): Promise<boolean | undefined> {
    const d = new Downloader({ mode: 'audio' }) as unknown as PrivateDownloader & {
      fetchTikTokMeta(): Promise<Record<string, string>>
    }
    vi.spyOn(d, 'tryCobaltInstances').mockResolvedValue(cobalt)
    vi.spyOn(d, 'probeStream').mockResolvedValue({ verdict: 'unreachable' })
    vi.spyOn(d, 'fetchTikTokMeta').mockResolvedValue({})
    let seen: boolean | undefined
    vi.spyOn(Downloader.prototype, 'downloadVideo').mockImplementation(async function (
      this: unknown,
    ) {
      seen = (this as { skipCobalt: boolean }).skipCobalt
      return { title: 't', downloadUrl: 'https://co.example/tunnel?id=v' } as never
    })
    const out = await d.downloadAudio(TIKTOK, 'tiktok')
    expect(out.musicUrl).toBe('https://co.example/tunnel?id=v')
    return seen
  }

  it('keeps Cobalt in the video resolve when its audio tunnel was empty', async () => {
    expect(await innerSkipCobalt({ title: 'x', downloadUrl: '', musicUrl: TUNNEL })).toBe(false)
  })

  it('skips Cobalt in the video resolve when Cobalt had no answer', async () => {
    expect(await innerSkipCobalt(null)).toBe(true)
  })
})
