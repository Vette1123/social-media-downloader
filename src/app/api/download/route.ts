import { NextRequest, NextResponse } from 'next/server'
import { Downloader } from '../../../lib/downloader'
import { validateUrl, detectPlatform } from '../../../lib/validator'
import { getCached, setCached } from '../../../lib/responseCache'

export async function POST(request: NextRequest) {
  try {
    const { url, type = 'video', quality, format } = await request.json()
    const preferredQuality: 'hd' | 'sd' = quality === 'sd' ? 'sd' : 'hd'
    const mode: 'auto' | 'audio' = format === 'audio' ? 'audio' : 'auto'

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 },
      )
    }

    if (!validateUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid URL. Please paste a link from a supported platform: TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, or Vimeo.',
        },
        { status: 400 },
      )
    }

    const platform = detectPlatform(url)

    // Serve an identical recent resolve from the warm-instance cache — skips a
    // full extractor round-trip for immediate repeats (double-tap, HD/SD/MP3
    // re-pick, Recent re-tap). Keyed on everything that changes the result. The
    // cache only holds successes and expires fast (media URLs are ephemeral).
    const cacheKey = `${type}|${preferredQuality}|${mode}|${url}`
    const cached = getCached<Record<string, unknown>>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    console.log(`Processing ${platform} URL:`, url, 'Type:', type)

    const downloader = new Downloader({ quality: preferredQuality, mode })
    const videoData = await downloader.downloadVideo(url)

    // Accept the result if it yielded any downloadable media: a video stream,
    // a flagged photo carousel (TikTok), or a plain image set (Instagram posts).
    // Also accept an embed-only result (YouTube fallback: playable but not
    // downloadable).
    const hasImages = (videoData?.images?.length ?? 0) > 0
    if (
      !videoData ||
      (!videoData.downloadUrl &&
        !videoData.musicUrl &&
        !videoData.isPhotoCarousel &&
        !hasImages &&
        !videoData.embedUrl)
    ) {
      return NextResponse.json(
        { success: false, error: 'Failed to extract download URL' },
        { status: 500 },
      )
    }

    // Same-origin API paths (e.g. the yt-dlp streaming endpoint
    // /api/youtube?...) are already playable as-is — only external media URLs
    // need wrapping in the proxy routes.
    const toMediaUrl = (mediaUrl: string, proxyPath: string) =>
      mediaUrl.startsWith('/')
        ? mediaUrl
        : `${proxyPath}?url=${encodeURIComponent(mediaUrl)}`

    // Video proxy: forces video/mp4 content-type so browsers render a proper video player.
    // Audio proxy: re-serves the video stream OR slideshow music as audio/mpeg.
    const videoProxyUrl = videoData.downloadUrl
      ? toMediaUrl(videoData.downloadUrl, '/api/video')
      : undefined

    // Prefer the dedicated music track (photo carousels / some videos) — falls back to
    // re-serving the video stream as audio when no separate track is available.
    const audioSourceUrl = videoData.musicUrl || videoData.downloadUrl
    const audioProxyUrl = audioSourceUrl
      ? toMediaUrl(audioSourceUrl, '/api/audio')
      : undefined

    // Instagram's CDN blocks cross-origin <img>/fetch from the browser (it only
    // serves to instagram.com), so image URLs must be routed through our
    // same-origin /api/image proxy for both display and download. TikTok/Twitter
    // images load directly, so they are left untouched.
    const isInstagram = platform === 'instagram'
    const proxyImage = (u: string) =>
      isInstagram && u ? `/api/image?url=${encodeURIComponent(u)}` : u

    // Direct-download URLs: a Cobalt tunnel streams from any IP with
    // Content-Disposition: attachment, so the browser can pull it straight down
    // without our /api/video|audio proxy re-streaming every byte through the
    // function. Only expose these for tunnels (never a raw CDN redirect, which
    // needs the proxy for referer/content-type) and never for same-origin
    // (/api/…) streams, which are already local.
    const directVideoUrl =
      videoData.tunnel &&
      videoData.downloadUrl &&
      !videoData.downloadUrl.startsWith('/')
        ? videoData.downloadUrl
        : undefined
    const directAudioUrl =
      videoData.tunnel &&
      videoData.musicUrl &&
      !videoData.musicUrl.startsWith('/')
        ? videoData.musicUrl
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
        // Raw (non-proxied) URLs needed by the /api/slideshow renderer
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

    // Cache the successful result for a short window (see responseCache).
    setCached(cacheKey, payload)

    return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process video',
      },
      { status: 500 },
    )
  }
}
