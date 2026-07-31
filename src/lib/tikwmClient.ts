/**
 * TikTok resolution from the BROWSER, bypassing our own API entirely.
 *
 * Why this exists: `Downloader.downloadTikTok` already tries tikwm first,
 * because it returns the richest result and a CDN URL that isn't bound to the
 * extracting IP. But tikwm sits behind Cloudflare and 403s datacenter traffic,
 * so on production that first attempt always misses and we fall through to a
 * cobalt tunnel. Measured, that costs us twice over:
 *
 *   cobalt public tunnel   ~106 KB/s
 *   tikwm's CDN URL       ~2.65 MB/s
 *
 * The user's browser is a residential IP, so it is not 403'd. And the media URL
 * tikwm hands back answers cross-origin requests (`Access-Control-Allow-Origin:
 * *`) with a real `Content-Length` and range support — which means the browser
 * can fetch it directly, with an accurate progress bar, and not one byte or one
 * millisecond of CPU touches our Worker.
 *
 * This is strictly an accelerator. Every failure path returns null and the
 * caller falls back to POST /api/download, which is unchanged.
 */

import type { ImageData, VideoMetadata } from './appReducer'

const TIKWM_ENDPOINT = 'https://www.tikwm.com/api/'

// A third party we do not control sits on the critical path of a paste, so it
// gets a short leash: past this we abandon it and let the server resolve.
const TIKWM_TIMEOUT_MS = 6000

/** The subset of tikwm's response we rely on. Everything is optional — it's a
 *  third-party shape and a missing field just means "fall back to the server". */
interface TikwmResponse {
  code?: number
  msg?: string
  data?: {
    id?: string
    title?: string
    cover?: string
    origin_cover?: string
    duration?: number
    play?: string
    hdplay?: string
    wmplay?: string
    music?: string
    images?: string[]
    author?: { nickname?: string; unique_id?: string }
    music_info?: { title?: string; author?: string }
  }
}

/** What a resolve returns to the app — same shape POST /api/download produces. */
export interface ClientResolve {
  success: true
  downloadUrl: string
  audioUrl: string
  metadata: VideoMetadata
}

/** Same-origin proxy URL, used as the *fallback* download route for a media URL
 *  the browser could not fetch itself. */
function proxied(path: string, mediaUrl: string): string {
  return `${path}?url=${encodeURIComponent(mediaUrl)}`
}

/** Prefer the HD rendition when asked for it and tikwm actually produced one.
 *  `hdplay` is frequently empty, so `play` is the real default. */
function pickVideoUrl(
  data: NonNullable<TikwmResponse['data']>,
  quality: 'hd' | 'sd',
): string {
  if (quality === 'hd' && data.hdplay) return data.hdplay
  return data.play || data.hdplay || ''
}

function toImages(urls: string[]): ImageData[] {
  return urls.map((url, index) => ({
    id: `tikwm-${index}`,
    url,
    thumbnail: url,
    selected: false,
  }))
}

/**
 * Resolve a TikTok URL in the browser. Returns null whenever anything at all is
 * off — non-TikTok URL, timeout, rate limit, error payload, or a response with
 * no usable media — so the caller can fall through to the server path.
 *
 * Only handles the video format. Audio mode (`format: 'audio'`) asks cobalt for
 * a transcoded MP3 tunnel, which is not something tikwm offers and not
 * something worth reimplementing here; that keeps the MP3 flow exactly as it
 * was. The "Extract Audio" button still benefits, because the audio URL below
 * is tikwm's own CDN track rather than a re-serve of the video stream.
 */
export async function resolveTikTokInBrowser(
  url: string,
  quality: 'hd' | 'sd',
): Promise<ClientResolve | null> {
  if (typeof window === 'undefined') return null

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIKWM_TIMEOUT_MS)
  try {
    const endpoint = `${TIKWM_ENDPOINT}?url=${encodeURIComponent(url)}${
      quality === 'hd' ? '&hd=1' : ''
    }`
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null

    const body: TikwmResponse = await response.json()
    // tikwm signals failure in the body, not the status: code 0 is success and
    // anything else (rate limit, private post, bad URL) means try the server.
    if (body.code !== 0 || !body.data) return null

    const data = body.data
    const videoUrl = pickVideoUrl(data, quality)
    const musicUrl = data.music || ''
    const images = Array.isArray(data.images) ? data.images : []
    if (!videoUrl && !musicUrl && images.length === 0) return null

    const metadata: VideoMetadata = {
      title: data.title || 'TikTok Video',
      author: data.author?.nickname || data.author?.unique_id || 'Unknown',
      duration: Math.round(data.duration || 0),
      thumbnail: data.cover || data.origin_cover || '',
      platform: 'tiktok',
      isPhotoCarousel: images.length > 0,
      images: images.length > 0 ? toImages(images) : undefined,
      musicTitle: data.music_info?.title,
      musicAuthor: data.music_info?.author,
      rawMusicUrl: musicUrl || undefined,
      // The whole point: hand the raw CDN URLs to the download buttons so the
      // browser streams them itself. They are NOT attachment responses, so if
      // that stream fails the caller must retry through the proxy rather than
      // navigating an iframe at them (which would play the file in a tab
      // instead of saving it).
      directVideoUrl: videoUrl || undefined,
      directAudioUrl: musicUrl || undefined,
      directIsAttachment: false,
    }

    return {
      success: true,
      // The proxied URLs stay the fallback route and the preview source, exactly
      // as with a server resolve.
      downloadUrl: videoUrl ? proxied('/api/video', videoUrl) : '',
      audioUrl: musicUrl ? proxied('/api/audio', musicUrl) : '',
      metadata,
    }
  } catch {
    // Timeout, offline, DNS-blocked by an ad blocker, CORS surprise — all of
    // them mean the same thing here: let the server do it.
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
