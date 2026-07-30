/**
 * Every /api/* handler, implemented against plain `Request`/`Response`.
 *
 * The App Router files under src/app/api/ are thin wrappers over these, and the
 * Cloudflare Worker entrypoint dispatches them directly from API_ROUTES so that
 * Next is never initialized for an API call.
 *
 * That indirection exists purely because of the free plan's 10 ms CPU budget.
 * Next's server initializes lazily and bills whichever request triggers it:
 * measured at 129 ms for /api/download and 92 ms for /api/slideshow — and the
 * latter only ever returns "not supported here". Every new isolate pays it
 * again, so it is not a one-off cold-start cost. Dispatched from here, the same
 * handlers run in single-digit milliseconds.
 *
 * Keeping one implementation shared by both paths is what makes this safe:
 * `next dev` and any Node host exercise exactly the code Cloudflare runs.
 */

import { Downloader } from './downloader'
import { validateUrl, detectPlatform } from './validator'
import { getCached, setCached } from './responseCache'
import { readEdgeCache, writeEdgeCache, type WaitUntilContext } from './edgeCache'
import { slugify } from './filename'
import { nativeMediaAvailable, nativeMediaUnavailable } from './nativeMedia'
import { MEDIA_PROXY_HANDLERS } from './mediaProxy'

type Handler = (
  request: Request,
  ctx?: WaitUntilContext,
) => Promise<Response> | Response

/**
 * A resolve served from cache. `X-Cache` distinguishes the two tiers so the
 * smoke test can assert the edge cache is actually live — the Cache API is a
 * silent no-op on workers.dev, and a silent no-op is exactly the kind of thing
 * that looks fine until you check.
 */
function cachedResponse(body: string, tier: 'HIT' | 'EDGE'): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'X-Cache': tier },
  })
}

/** Same-origin paths are already local; only external media needs the proxy. */
function toMediaUrl(mediaUrl: string, proxyPath: string): string {
  if (mediaUrl.startsWith('/')) return mediaUrl
  return `${proxyPath}?url=${encodeURIComponent(mediaUrl)}`
}

/**
 * A cobalt tunnel streams from any IP with `Content-Disposition: attachment`,
 * so the browser can pull it directly instead of re-streaming every byte
 * through the Worker — which would both cost CPU and put video traffic through
 * Cloudflare, which the free plan does not permit.
 *
 * Forced to https: a self-hosted instance behind a TLS-terminating proxy can
 * report an http self-URL, and an https page navigating to that is a
 * mixed-content navigation which displays the file instead of downloading it.
 */
function asDirectTunnel(url: string | undefined): string | undefined {
  if (!url || url.startsWith('/')) return undefined
  return url.replace(/^http:\/\//i, 'https://')
}

export async function handleDownload(
  request: Request,
  ctx?: WaitUntilContext,
): Promise<Response> {
  try {
    const { url, type = 'video', quality, format } = await request.json()
    const preferredQuality: 'hd' | 'sd' = quality === 'sd' ? 'sd' : 'hd'
    const mode: 'auto' | 'audio' = format === 'audio' ? 'audio' : 'auto'

    if (!url) {
      return Response.json({ success: false, error: 'URL is required' }, { status: 400 })
    }

    if (!validateUrl(url)) {
      return Response.json(
        {
          success: false,
          error:
            'Invalid URL. Please paste a link from a supported platform: TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, or Vimeo.',
        },
        { status: 400 },
      )
    }

    const platform = detectPlatform(url)

    // Serve an identical recent resolve from cache — skips a full extractor
    // round-trip for repeats (double-tap, HD/SD/MP3 re-pick, Recent re-tap, or
    // simply a link several people paste). Keyed on everything that changes the
    // result.
    //
    // Two tiers, cheapest first: the per-isolate Map, then Cloudflare's colo-
    // wide edge cache. The Map only catches a repeat that happens to land on
    // the same warm isolate, which is a minority of them; the edge cache is
    // shared across every isolate in the colo and is what makes a popular link
    // essentially free to re-resolve.
    const cacheKey = `${type}|${preferredQuality}|${mode}|${url}`
    const cached = getCached(cacheKey)
    if (cached) return cachedResponse(cached, 'HIT')

    const origin = new URL(request.url).origin
    const edge = await readEdgeCache(origin, cacheKey)
    if (edge) {
      // Promote into this isolate so a second repeat skips even the edge
      // lookup, which is I/O and therefore latency the Map does not cost.
      setCached(cacheKey, edge)
      return cachedResponse(edge, 'EDGE')
    }

    const downloader = new Downloader({ quality: preferredQuality, mode })
    const videoData = await downloader.downloadVideo(url)

    // Accept the result if it yielded any downloadable media: a video stream, a
    // flagged photo carousel (TikTok), a plain image set (Instagram posts), or
    // an embed-only result (YouTube fallback: playable but not downloadable).
    const hasImages = (videoData?.images?.length ?? 0) > 0
    if (
      !videoData ||
      (!videoData.downloadUrl &&
        !videoData.musicUrl &&
        !videoData.isPhotoCarousel &&
        !hasImages &&
        !videoData.embedUrl)
    ) {
      return Response.json(
        { success: false, error: 'Failed to extract download URL' },
        { status: 500 },
      )
    }

    // Video proxy forces video/mp4 so browsers render a real player; the audio
    // proxy re-serves the video stream, or slideshow music, as audio/mpeg.
    const videoProxyUrl = videoData.downloadUrl
      ? toMediaUrl(videoData.downloadUrl, '/api/video')
      : undefined

    // Prefer a dedicated music track (photo carousels), else re-serve the video.
    const audioSourceUrl = videoData.musicUrl || videoData.downloadUrl
    const audioProxyUrl = audioSourceUrl
      ? toMediaUrl(audioSourceUrl, '/api/audio')
      : undefined

    // Instagram's CDN only serves to instagram.com, so its image URLs must go
    // through our same-origin proxy for both display and download. TikTok and
    // Twitter images load directly and are left untouched.
    const isInstagram = platform === 'instagram'
    const proxyImage = (u: string) =>
      isInstagram && u ? `/api/image?url=${encodeURIComponent(u)}` : u

    const directVideoUrl = videoData.tunnel
      ? asDirectTunnel(videoData.downloadUrl)
      : undefined
    const directAudioUrl = videoData.tunnel
      ? asDirectTunnel(videoData.musicUrl)
      : undefined

    const payload = {
      success: true,
      downloadUrl: videoProxyUrl,
      audioUrl: audioProxyUrl,
      metadata: {
        title: videoData.title,
        author: videoData.author,
        duration: videoData.duration,
        thumbnail: proxyImage(videoData.thumbnail),
        platform,
        isPhotoCarousel: videoData.isPhotoCarousel ?? false,
        embedUrl: videoData.embedUrl,
        musicTitle: videoData.musicTitle,
        musicAuthor: videoData.musicAuthor,
        // Raw (non-proxied) URL needed by the /api/slideshow renderer.
        rawMusicUrl: videoData.musicUrl,
        directVideoUrl,
        directAudioUrl,
        images:
          videoData.images?.map((img) => ({
            ...img,
            url: proxyImage(img.url),
            thumbnail: proxyImage(img.thumbnail),
            selected: false,
          })) || [],
      },
    }

    // Serialised once, then reused for the response and both cache tiers —
    // rather than handing the object to Response.json() and stringifying it
    // again for storage.
    const body = JSON.stringify(payload)
    setCached(cacheKey, body)
    writeEdgeCache(origin, cacheKey, body, ctx)

    return new Response(body, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process video',
      },
      { status: 500 },
    )
  }
}

/**
 * Image URLs may arrive already wrapped in our own `/api/image?url=<raw>`
 * display proxy (Instagram). Unwrap back to the raw CDN URL so it can be
 * re-wrapped cleanly rather than double-proxied.
 */
function toRawImageUrl(u: string): string {
  if (!u.startsWith('/api/image')) return u
  const marker = 'url='
  const index = u.indexOf(marker)
  if (index === -1) return u
  try {
    return decodeURIComponent(u.slice(index + marker.length))
  } catch {
    return u
  }
}

/**
 * Resolves a carousel's images to same-origin download URLs.
 *
 * Deliberately does no fetching. It used to build the ZIP here — pulling every
 * image into memory and running DEFLATE over already-compressed JPEGs, which a
 * 20-image post could push to ~100 MB inside a 128 MB isolate. Archiving now
 * happens in the browser, where the bytes are headed anyway, leaving this as a
 * pure mapping: no subrequests, constant time in the image count.
 */
export async function handleImages(request: Request): Promise<Response> {
  try {
    const { imageUrls, title } = await request.json()

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return Response.json({ success: false, error: 'No images provided' }, { status: 400 })
    }

    // Slug used for entry names so extracted files stay recognisable.
    const titleSlug = (typeof title === 'string' && slugify(title, 40)) || 'image'
    const pad = Math.max(2, String(imageUrls.length).length)

    return Response.json({
      success: true,
      images: imageUrls.map((url: string, index: number) => ({
        url: `/api/image?url=${encodeURIComponent(toRawImageUrl(url))}`,
        filename: `${titleSlug}_${String(index + 1).padStart(pad, '0')}.jpg`,
      })),
    })
  } catch {
    return Response.json(
      { success: false, error: 'Failed to process images' },
      { status: 500 },
    )
  }
}

/**
 * The three routes backed by yt-dlp/ffmpeg. workerd has neither subprocesses
 * nor a writable filesystem, so on Cloudflare they can only ever answer 501 —
 * which the Worker does here without loading Next or the route's own module.
 *
 * The guard is re-checked rather than assumed so the same table stays correct
 * if these are ever dispatched from a host that does have the binaries.
 */
function nativeMediaRoute(feature: string): Handler {
  return () => {
    if (!nativeMediaAvailable()) return nativeMediaUnavailable(feature)
    // Unreachable on Cloudflare. On a capable host the Next route serves it,
    // so this table entry is simply not consulted.
    return new Response(null, { status: 501 })
  }
}

/**
 * Pathname -> { method, handler }, consumed by cloudflare/worker.js.
 *
 * Any /api/* path absent from this table falls through to Next. Adding a route
 * without adding it here is therefore safe but slow — scripts/cf-smoke.mjs
 * asserts the CPU-sensitive ones are actually served from here.
 */
export const API_ROUTES: Record<string, { method: string; handler: Handler }> = {
  '/api/download': { method: 'POST', handler: handleDownload },
  '/api/images': { method: 'POST', handler: handleImages },
  '/api/slideshow': { method: 'POST', handler: nativeMediaRoute('Slideshow rendering') },
  '/api/tiktok': { method: 'GET', handler: nativeMediaRoute('Direct TikTok download') },
  '/api/youtube': { method: 'GET', handler: nativeMediaRoute('Direct YouTube download') },
  ...Object.fromEntries(
    Object.entries(MEDIA_PROXY_HANDLERS).map(([pathname, handler]) => [
      pathname,
      { method: 'GET', handler },
    ]),
  ),
}
