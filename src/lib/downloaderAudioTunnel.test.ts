import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader } from './downloader'

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
