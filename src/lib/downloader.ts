import axios from 'axios'
import * as cheerio from 'cheerio'
import { VideoData, ImageData } from './types'
import {
  parseVideoId,
  detectPlatform,
  parseInstagramShortcode,
  parseYouTubeId,
} from './validator'
import { getMediaReferer } from './proxyHeaders'

// Loose shapes for Instagram's GraphQL / embed `shortcode_media` payload.
// Only the fields we actually read are typed; everything else is ignored.
interface IgMediaNode {
  __typename?: string
  is_video?: boolean
  video_url?: string
  display_url?: string
  thumbnail_src?: string
  display_resources?: Array<{ src: string }>
}

interface IgShortcodeMedia extends IgMediaNode {
  owner?: { username?: string; full_name?: string }
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> }
  edge_sidecar_to_children?: { edges?: Array<{ node?: IgMediaNode }> }
  video_duration?: number
}

export class Downloader {
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  // Browser-renderable video codecs (bvc2 / ByteDance proprietary codec is NOT in this list)
  private readonly supportedVideoCodecs = [
    'avc1',
    'avc2',
    'avc3', // H.264
    'hvc1',
    'hev1', // H.265/HEVC
    'vp08',
    'vp09', // VP8/VP9
    'av01', // AV1
  ]

  // Public community cobalt instances. Cobalt deliberately stopped publishing
  // its public instance list (YouTube scraping abuse), so this is a curated,
  // probe-verified set led by the most reliable instance. Cobalt tunnels the
  // media, so the URL it returns plays cross-origin (unlike a raw CDN URL).
  private readonly cobaltInstances = [
    'https://co.otomir23.me/',
    'https://cobalt-backend.canine.tools/',
    'https://co.eepy.today/',
    'https://cobalt.255x.ru/',
  ]

  // Public Instagram web app id — required by the GraphQL/web-API endpoints.
  // This is the same id Instagram's own web client sends and is not a secret.
  private readonly instagramAppId = '936619743392459'

  // Public Piped instances (open-source YouTube frontends). Their /streams
  // endpoint returns muxed/progressive formats whose URLs are proxied by the
  // instance, so they play cross-origin. Used as a YouTube fallback.
  private readonly pipedInstances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.reallyaweso.me',
    'https://pipedapi.adminforge.de',
  ]

  // Main entry point: auto-detects platform and routes accordingly
  async downloadVideo(url: string): Promise<VideoData> {
    const platform = detectPlatform(url)

    if (platform === 'tiktok') {
      return this.downloadTikTok(url)
    }

    if (platform === 'twitter') {
      const methods = [
        () => this.tryVxTwitterMethod(url),
        () => this.tryCobaltInstances(url),
      ]
      for (const method of methods) {
        try {
          const result = await method()
          if (result) return result
        } catch (e) {
          console.warn('Twitter method failed, trying next...', e)
        }
      }
      throw new Error(
        'Could not download Twitter/X content. The post may be private, age-restricted, or unavailable.',
      )
    }

    if (platform === 'instagram') {
      return this.downloadInstagram(url)
    }

    if (platform === 'youtube') {
      return this.downloadYouTube(url)
    }

    if (platform === 'facebook') {
      return this.downloadFacebook(url)
    }

    throw new Error(
      'Unsupported URL. Please use a TikTok, Twitter/X, Instagram, Facebook, or YouTube link.',
    )
  }

  /**
   * YouTube: Cobalt is the primary extractor (it tunnels the stream, so the
   * resulting URL is not IP-locked to a single requester the way a raw
   * googlevideo URL is). Piped/Invidious public instances are the fallback.
   *
   * Cobalt returns sparse metadata, so the title/author/thumbnail are always
   * enriched from YouTube's public oEmbed endpoint (login-free).
   */
  private async downloadYouTube(url: string): Promise<VideoData> {
    const videoId = parseYouTubeId(url)
    // Normalise to a canonical watch URL — short/shorts/embed links confuse
    // some extractors, and oEmbed expects a standard watch URL.
    const canonical = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url

    const meta = await this.fetchYouTubeMeta(videoId, canonical)

    const methods: Array<() => Promise<VideoData | null>> = [
      () => this.tryCobaltInstances(canonical),
      () => (videoId ? this.tryPipedInstances(videoId) : Promise.resolve(null)),
    ]

    for (const method of methods) {
      try {
        const result = await method()
        if (result && result.downloadUrl) {
          // Reject dead/region-locked stream URLs so the UI never shows a
          // broken player — fall through to the next extractor instead.
          if (!(await this.verifyStreamReachable(result.downloadUrl))) {
            console.warn('YouTube candidate stream unreachable, trying next...')
            continue
          }
          // YouTube never yields a photo gallery.
          result.isPhotoCarousel = false
          result.images = undefined
          // Prefer the richer oEmbed metadata over the extractor's guesses.
          if (meta.title) result.title = meta.title
          if (meta.author) result.author = meta.author
          if (meta.thumbnail) result.thumbnail = meta.thumbnail
          if (videoId) result.id = videoId
          return result
        }
      } catch (e) {
        console.warn('YouTube method failed, trying next...', e)
      }
    }

    throw new Error(
      'Could not download this YouTube video. It may be private, age-restricted, region-locked, or a live stream.',
    )
  }

  /**
   * Facebook: try the login-free extractors in order of reliability.
   *   1. The public video plugin page (`/plugins/video.php`) ships the stream
   *      config for any public video without a login wall.
   *   2. Direct scraping of the watch/reel page JSON (`browser_native_*_url`).
   *   3. Cobalt instances as the community fallback.
   *
   * fb.watch and /share/ links are resolved to their canonical URL first.
   */
  private async downloadFacebook(url: string): Promise<VideoData> {
    let resolvedUrl = url
    if (
      url.includes('fb.watch') ||
      url.includes('/share/') ||
      url.includes('fb.com')
    ) {
      resolvedUrl = await this.resolveRedirect(url)
    }

    const methods: Array<() => Promise<VideoData | null>> = [
      () => this.tryFacebookPlugin(resolvedUrl, url),
      () => this.tryFacebookScrape(resolvedUrl, url),
      () => this.tryCobaltInstances(resolvedUrl),
    ]

    for (const method of methods) {
      try {
        const result = await method()
        if (result && result.downloadUrl) {
          result.isPhotoCarousel = false
          result.images = undefined
          return result
        }
      } catch (e) {
        console.warn('Facebook method failed, trying next...', e)
      }
    }

    throw new Error(
      'Could not download this Facebook video. The post may be private, age-restricted, or unavailable.',
    )
  }

  /**
   * Instagram: resolve any share/short link to its canonical post URL, then
   * try several login-free extractors in order of reliability:
   *   1. Instagram's own web GraphQL endpoint (richest metadata, carousels)
   *   2. The public embed page (resilient for public single posts)
   *   3. Cobalt instances (last-resort community fallback)
   *
   * Instagram posts are mapped onto the same VideoData shape as everything
   * else: a single primary video goes in `downloadUrl`, while photos (and the
   * frames of a carousel) populate `images[]`. `isPhotoCarousel` is left false
   * on purpose — IG carousels are plain image sets, not music-backed TikTok
   * slideshows, so they should reuse the generic gallery, not the ffmpeg
   * slideshow renderer.
   */
  private async downloadInstagram(url: string): Promise<VideoData> {
    let resolvedUrl = url
    if (url.includes('/share/') || url.includes('instagr.am')) {
      resolvedUrl = await this.resolveInstagramUrl(url)
    }

    const shortcode =
      parseInstagramShortcode(resolvedUrl) || parseInstagramShortcode(url)

    // The public embed page is the most reliable login-free source today;
    // the GraphQL/mobile endpoints are largely login-gated, so they sit last
    // as long-shot fallbacks alongside Cobalt.
    const methods: Array<() => Promise<VideoData | null>> = [
      () =>
        shortcode
          ? this.tryInstagramEmbed(shortcode, url)
          : Promise.resolve(null),
      () => this.tryCobaltInstances(resolvedUrl),
      () =>
        shortcode
          ? this.tryInstagramGraphQL(shortcode, url)
          : Promise.resolve(null),
    ]

    for (const method of methods) {
      try {
        const result = await method()
        if (result && (result.downloadUrl || (result.images?.length ?? 0) > 0)) {
          // IG never uses the TikTok-style slideshow render path.
          result.isPhotoCarousel = false
          return result
        }
      } catch (e) {
        console.warn('Instagram method failed, trying next...', e)
      }
    }

    throw new Error(
      'Could not download Instagram content. The post may be private, age-restricted, or unavailable.',
    )
  }

  /**
   * Checks whether a video URL uses a browser-compatible codec.
   * TikTok's HDplay sometimes uses bvc2 (ByteDance proprietary codec) which browsers cannot render.
   * In that case we fall back to the standard play URL (H.264/avc1).
   */
  private async checkVideoCodecCompatible(url: string): Promise<boolean> {
    try {
      const referer = url.includes('tikwm.com')
        ? 'https://www.tikwm.com/'
        : url.includes('tiktok')
          ? 'https://www.tiktok.com/'
          : ''
      const response = await axios.get(url, {
        headers: {
          Range: 'bytes=0-65535',
          'User-Agent': this.userAgent,
          ...(referer ? { Referer: referer } : {}),
        },
        responseType: 'arraybuffer',
        timeout: 12000,
        maxRedirects: 5,
      })
      const bytes = Buffer.from(response.data as ArrayBuffer)
      return this.supportedVideoCodecs.some((codec) =>
        bytes.includes(Buffer.from(codec)),
      )
    } catch {
      // If the check fails we optimistically assume the codec is fine
      return true
    }
  }

  /**
   * Confirms a candidate stream URL actually serves bytes before we hand it to
   * the client. Public Cobalt/Piped instances sometimes return dead or
   * region-locked URLs (e.g. an LBRY mirror that 401s); without this check the
   * UI would show a broken player. A ranged GET keeps it cheap.
   */
  private async verifyStreamReachable(url: string): Promise<boolean> {
    try {
      const referer = getMediaReferer(url)
      const response = await axios.get(url, {
        headers: {
          Range: 'bytes=0-1024',
          'User-Agent': this.userAgent,
          ...(referer ? { Referer: referer } : {}),
        },
        responseType: 'arraybuffer',
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: () => true,
      })
      return response.status === 200 || response.status === 206
    } catch {
      return false
    }
  }

  private async downloadTikTok(url: string): Promise<VideoData> {
    const videoId = parseVideoId(url)
    if (!videoId) {
      throw new Error('Could not extract video ID from URL')
    }

    // tikwm is the most reliable — try it first, then fall back to the others
    const methods = [
      () => this.tryTikwmMethod(url),
      () => this.trySnaptikMethod(url),
      () => this.trySSSMethod(url),
      () => this.tryDirectTikTokScraping(url),
    ]

    for (const method of methods) {
      try {
        const result = await method()
        if (result) {
          console.log('Successfully downloaded video using method')
          return result
        }
      } catch (error) {
        console.warn('Method failed, trying next...', error)
        continue
      }
    }

    throw new Error(
      'All download methods failed. TikTok might be blocking requests or the video is private.',
    )
  }

  // Try every public cobalt instance in order
  private async tryCobaltInstances(url: string): Promise<VideoData | null> {
    const errors: string[] = []
    for (const instance of this.cobaltInstances) {
      try {
        const result = await this.tryCobaltInstance(instance, url)
        if (result) return result
      } catch (e) {
        errors.push(`${instance}: ${e}`)
      }
    }
    console.warn('All cobalt instances failed:', errors)
    return null
  }

  private async tryCobaltInstance(
    baseUrl: string,
    url: string,
  ): Promise<VideoData | null> {
    const response = await axios.post(
      baseUrl,
      { url, videoQuality: 'max', filenameStyle: 'basic' },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      },
    )

    const data = response.data

    if (data.status === 'error') {
      throw new Error(
        `Cobalt error: ${data.error?.code ?? JSON.stringify(data.error)}`,
      )
    }

    if (data.status === 'tunnel' || data.status === 'redirect') {
      return {
        id: Date.now().toString(),
        title: data.filename?.replace(/\.[^.]+$/, '') || 'Social Media Video',
        url,
        thumbnail: '',
        duration: 0,
        author: 'Unknown',
        description: '',
        downloadUrl: data.url,
      }
    }

    if (data.status === 'picker') {
      const items = data.picker as Array<{
        type: string
        url: string
        thumb?: string
      }>
      const videos = items?.filter((p) => p.type === 'video') || []
      const photos = items?.filter((p) => p.type === 'photo') || []
      const downloadUrl = videos[0]?.url || items?.[0]?.url || ''

      const images: ImageData[] = photos.map(
        (img: { url: string; thumb?: string }, i: number) => ({
          id: `img_${i}`,
          url: img.url,
          thumbnail: img.thumb || img.url,
        }),
      )

      return {
        id: Date.now().toString(),
        title: data.filename?.replace(/\.[^.]+$/, '') || 'Social Media Content',
        url,
        thumbnail: items?.[0]?.thumb || '',
        duration: 0,
        author: 'Unknown',
        description: '',
        downloadUrl,
        images: images.length > 0 ? images : undefined,
        isPhotoCarousel: images.length > 0,
      }
    }

    console.warn('Cobalt unexpected status:', data.status, data)
    return null
  }

  // Twitter/X: use vxtwitter API (open source, no auth required)
  private async tryVxTwitterMethod(url: string): Promise<VideoData | null> {
    // Extract username and tweet ID from URL
    const match = url.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/)
    if (!match) throw new Error('Could not parse Twitter URL')
    const [, username, tweetId] = match

    const response = await axios.get(
      `https://api.vxtwitter.com/${username}/status/${tweetId}`,
      {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        timeout: 20000,
      },
    )

    const data = response.data

    // Find best video media
    const mediaItems = (data.media_extended ?? data.media ?? []) as Array<{
      type: string
      url: string
      thumbnail_url?: string
      altText?: string
    }>

    const videoItem = mediaItems.find(
      (m) => m.type === 'video' || m.type === 'gif',
    )
    const photoItems = mediaItems.filter((m) => m.type === 'image')

    if (!videoItem && photoItems.length === 0) {
      throw new Error('No downloadable media found in tweet')
    }

    const downloadUrl = videoItem?.url || ''
    const images: ImageData[] = photoItems.map((img, i) => ({
      id: `tw_img_${i}`,
      url: img.url,
      thumbnail: img.thumbnail_url || img.url,
    }))

    return {
      id: tweetId,
      title: data.text
        ? data.text.slice(0, 80).replace(/\s+/g, ' ')
        : `Tweet by @${username}`,
      url,
      thumbnail: videoItem?.thumbnail_url || photoItems[0]?.url || '',
      duration: 0,
      author: data.user_name || username,
      description: data.text || '',
      downloadUrl,
      images: images.length > 0 ? images : undefined,
      isPhotoCarousel: images.length > 0 && !videoItem,
    }
  }

  private async trySnaptikMethod(url: string): Promise<VideoData | null> {
    try {
      // Step 1: Get the main page to extract necessary tokens
      await axios.get('https://snaptik.app/', {
        headers: { 'User-Agent': this.userAgent },
      })

      // Step 2: Submit the URL
      const formData = new URLSearchParams()
      formData.append('url', url)

      const response = await axios.post(
        'https://snaptik.app/abc2.php',
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
            Referer: 'https://snaptik.app/',
            Origin: 'https://snaptik.app',
          },
          timeout: 30000,
        },
      )

      if (response.data && typeof response.data === 'string') {
        const $ = cheerio.load(response.data)

        // Look for download links
        const downloadLinks: string[] = []
        $('a[href*=".mp4"], a[download*=".mp4"]').each((_, element) => {
          const href = $(element).attr('href')
          if (href && href.includes('.mp4')) {
            downloadLinks.push(href)
          }
        })

        if (downloadLinks.length > 0) {
          const videoId = parseVideoId(url) || 'unknown'
          return {
            id: videoId,
            title: 'TikTok Video (Snaptik)',
            url: url,
            thumbnail: '',
            duration: 0,
            author: 'Unknown',
            description: 'Downloaded via Snaptik',
            downloadUrl: downloadLinks[0], // Use the first (usually highest quality) link
          }
        }
      }
    } catch {
      throw new Error('Snaptik method failed')
    }
    return null
  }

  private async trySSSMethod(url: string): Promise<VideoData | null> {
    try {
      const response = await axios.post(
        'https://ssstik.io/abc',
        {
          id: url,
          locale: 'en',
          tt: 'RFBiZ3Bi',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://ssstik.io',
            Referer: 'https://ssstik.io/en',
          },
          timeout: 30000,
        },
      )

      if (response.data && response.data.url) {
        const videoId = parseVideoId(url) || 'unknown'
        return {
          id: videoId,
          title: response.data.title || 'TikTok Video (SSSt)',
          url: url,
          thumbnail: response.data.cover || '',
          duration: response.data.duration || 0,
          author: response.data.author || 'Unknown',
          description: response.data.title || 'Downloaded via SSSTik',
          downloadUrl: response.data.url,
        }
      }
    } catch {
      throw new Error('SSSTik method failed')
    }
    return null
  }

  private async tryTikwmMethod(url: string): Promise<VideoData | null> {
    try {
      const response = await axios.post(
        'https://www.tikwm.com/api/',
        {
          url: url,
          count: 12,
          cursor: 0,
          web: 1,
          hd: 1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.tikwm.com',
            Referer: 'https://www.tikwm.com/',
          },
          timeout: 30000,
        },
      )

      if (response.data && response.data.code === 0 && response.data.data) {
        const data = response.data.data
        const videoId = parseVideoId(url) || 'unknown'

        // Helper: convert tikwm relative paths to absolute URLs
        const toAbsolute = (path: string | undefined): string | undefined =>
          path
            ? path.startsWith('/')
              ? 'https://www.tikwm.com' + path
              : path
            : undefined

        // Fix thumbnail URL (tikwm returns relative paths)
        const thumbnail = toAbsolute(data.cover) || ''

        // Check if this is a photo carousel (slideshow)
        const isPhotoCarousel =
          data.images && Array.isArray(data.images) && data.images.length > 0

        let images: ImageData[] = []
        if (isPhotoCarousel) {
          images = data.images.map((img: string, index: number) => ({
            id: `${videoId}_img_${index}`,
            url: img,
            thumbnail: img,
          }))
        }

        let downloadUrl: string | undefined

        // Photo carousels: skip tikwm's `play` URL — for slideshow posts it
        // points to an audio-only MP4 with no image frames. The /api/slideshow
        // route renders a proper images+music MP4 on demand instead.
        if (!isPhotoCarousel) {
          const hdplayUrl = toAbsolute(data.hdplay)
          const playUrl = toAbsolute(data.play)
          const wmplayUrl = toAbsolute(data.wmplay)

          if (hdplayUrl) {
            // Verify the HD URL uses a browser-renderable codec.
            // TikTok sometimes encodes with bvc2 (ByteDance proprietary) which no browser supports,
            // causing the video element to render audio-only ("shows as mp3").
            const hdCompatible = await this.checkVideoCodecCompatible(hdplayUrl)
            if (hdCompatible) {
              downloadUrl = hdplayUrl
            } else {
              console.log(
                `[tikwm] hdplay uses unsupported codec for ${videoId} — falling back to play (H.264)`,
              )
              downloadUrl = playUrl || wmplayUrl || hdplayUrl
            }
          } else {
            downloadUrl = playUrl || wmplayUrl
          }
        }

        // Slideshow soundtrack (TikTok photo carousels always have a music track)
        const musicUrl =
          toAbsolute(data.music_info?.play) || toAbsolute(data.music)
        const musicTitle = data.music_info?.title
        const musicAuthor = data.music_info?.author

        return {
          id: videoId,
          title: data.title || 'TikTok Video',
          url: url,
          thumbnail,
          duration: data.duration || 0,
          author: data.author?.nickname || 'Unknown',
          description: data.title || '',
          downloadUrl: downloadUrl ?? '',
          images,
          isPhotoCarousel,
          musicUrl,
          musicTitle,
          musicAuthor,
        }
      }
    } catch (e) {
      throw new Error(
        `Tikwm method failed: ${e instanceof Error ? e.message : e}`,
      )
    }
    return null
  }

  private async tryDirectTikTokScraping(
    url: string,
  ): Promise<VideoData | null> {
    try {
      // First resolve any shortened URLs
      const resolvedUrl = await this.resolveUrl(url)

      const response = await axios.get(resolvedUrl, {
        headers: {
          'User-Agent': this.userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      })

      // Parse TikTok's page for video data
      const $ = cheerio.load(response.data)

      // Look for JSON data in script tags
      const scripts = $('script').toArray()
      for (const script of scripts) {
        const content = $(script).html()
        if (content && content.includes('webapp.video-detail')) {
          try {
            // Extract video URLs from the script content
            const videoUrlMatch = content.match(/"playAddr":"([^"]+)"/)
            const downloadUrlMatch = content.match(/"downloadAddr":"([^"]+)"/)

            if (videoUrlMatch || downloadUrlMatch) {
              const videoId = parseVideoId(url) || 'unknown'
              const downloadUrl = (
                downloadUrlMatch?.[1] ||
                videoUrlMatch?.[1] ||
                ''
              ).replace(/\\u002F/g, '/')

              return {
                id: videoId,
                title: 'TikTok Video (Direct)',
                url: url,
                thumbnail: '',
                duration: 0,
                author: 'Unknown',
                description: 'Downloaded via direct scraping',
                downloadUrl: downloadUrl,
              }
            }
          } catch {
            continue
          }
        }
      }
    } catch {
      throw new Error('Direct scraping method failed')
    }
    return null
  }

  // Follow redirects on Instagram share/short links to the canonical post URL.
  private async resolveInstagramUrl(url: string): Promise<string> {
    return this.resolveRedirect(url)
  }

  // Generic redirect follower — resolves short/share links (fb.watch,
  // facebook.com/share/…, instagram share links) to their canonical URL.
  private async resolveRedirect(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': this.userAgent },
        timeout: 12000,
      })
      return response.request?.res?.responseUrl || url
    } catch {
      return url
    }
  }

  /**
   * Fetch YouTube title/author/thumbnail from the public oEmbed endpoint.
   * No login or API key required. Falls back to the deterministic ytimg
   * thumbnail (always available for public videos) when oEmbed is unavailable.
   */
  private async fetchYouTubeMeta(
    videoId: string | null,
    canonicalUrl: string,
  ): Promise<{ title?: string; author?: string; thumbnail?: string }> {
    const fallbackThumb = videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : ''
    try {
      const response = await axios.get(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          canonicalUrl,
        )}&format=json`,
        {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          timeout: 12000,
        },
      )
      const data = response.data
      return {
        title: data?.title,
        author: data?.author_name,
        thumbnail: data?.thumbnail_url || fallbackThumb,
      }
    } catch {
      return { thumbnail: fallbackThumb }
    }
  }

  // YouTube fallback: try public Piped instances. Their /streams endpoint
  // returns progressive (video+audio) formats with instance-proxied URLs.
  private async tryPipedInstances(videoId: string): Promise<VideoData | null> {
    const errors: string[] = []
    for (const instance of this.pipedInstances) {
      try {
        const response = await axios.get(`${instance}/streams/${videoId}`, {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          timeout: 20000,
        })
        const data = response.data
        // videoStreams with videoOnly === false are progressive (have audio).
        // Skip LBRY/Odysee mirrors (player.odycdn.com) — they frequently 401.
        // Prefer streams proxied through the Piped instance itself, which play
        // cross-origin; a raw googlevideo URL is IP-locked and may not.
        const progressive = (data?.videoStreams ?? []).filter(
          (s: { videoOnly?: boolean; url?: string }) =>
            s.videoOnly === false &&
            !!s.url &&
            !s.url.includes('odycdn') &&
            !s.url.includes('lbry'),
        ) as Array<{ url: string; quality?: string; mimeType?: string }>

        const isProxied = (u: string) =>
          u.includes('piped') || u.includes('proxy')
        const isMp4 = (s: { mimeType?: string }) =>
          (s.mimeType || '').includes('mp4')

        // Prefer: proxied + mp4 → proxied → mp4 → anything.
        const best =
          progressive.find((s) => isProxied(s.url) && isMp4(s)) ||
          progressive.find((s) => isProxied(s.url)) ||
          progressive.find((s) => isMp4(s)) ||
          progressive[0]
        if (!best?.url) continue

        return {
          id: videoId,
          title: data?.title || 'YouTube Video',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: data?.thumbnailUrl || '',
          duration: Math.round(data?.duration || 0),
          author: data?.uploader || 'Unknown',
          description: '',
          downloadUrl: best.url,
        }
      } catch (e) {
        errors.push(`${instance}: ${e}`)
      }
    }
    console.warn('All Piped instances failed:', errors)
    return null
  }

  /**
   * Facebook's public video plugin embed. It is designed to be embedded on
   * third-party sites, so it renders the stream config for any public video
   * without a login wall. We parse the same `*_url` keys the watch page ships.
   */
  private async tryFacebookPlugin(
    resolvedUrl: string,
    originalUrl: string,
  ): Promise<VideoData | null> {
    const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      resolvedUrl,
    )}`
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      timeout: 20000,
    })
    const html = typeof response.data === 'string' ? response.data : ''
    return this.parseFacebookHtml(html, originalUrl)
  }

  /**
   * Direct scrape of the public Facebook watch/reel page. The page embeds the
   * video config JSON containing the HD/SD source URLs.
   */
  private async tryFacebookScrape(
    resolvedUrl: string,
    originalUrl: string,
  ): Promise<VideoData | null> {
    const response = await axios.get(resolvedUrl, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 20000,
    })
    const html = typeof response.data === 'string' ? response.data : ''
    return this.parseFacebookHtml(html, originalUrl)
  }

  /**
   * Pull a playable video URL + metadata out of Facebook page/plugin HTML.
   * Facebook ships several source keys; we prefer HD, then SD, then the
   * generic playable_url. Values are JSON-escaped (%, \/, \uXXXX), so we
   * decode them before use.
   */
  private parseFacebookHtml(
    html: string,
    originalUrl: string,
  ): VideoData | null {
    if (!html) return null

    const pickUrl = (...keys: string[]): string => {
      for (const key of keys) {
        // Match "key":"<value>" capturing up to the next unescaped quote.
        const re = new RegExp(`"${key}":"(.*?)"(?:,|\\})`)
        const m = html.match(re)
        if (m && m[1]) {
          const decoded = this.decodeFacebookString(m[1])
          if (decoded.startsWith('http')) return decoded
        }
      }
      return ''
    }

    const downloadUrl = pickUrl(
      'browser_native_hd_url',
      'playable_url_quality_hd',
      'hd_src_no_ratelimit',
      'hd_src',
      'browser_native_sd_url',
      'playable_url',
      'sd_src_no_ratelimit',
      'sd_src',
    )

    if (!downloadUrl) return null

    const $ = cheerio.load(html)
    const ogTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      ''
    const ogImage = $('meta[property="og:image"]').attr('content') || ''
    const ogDescription =
      $('meta[property="og:description"]').attr('content') || ''

    const title =
      (ogTitle || ogDescription || 'Facebook Video')
        .slice(0, 100)
        .replace(/\s+/g, ' ')
        .trim() || 'Facebook Video'

    return {
      id: parseVideoId(originalUrl) || Date.now().toString(),
      title,
      url: originalUrl,
      thumbnail: ogImage,
      duration: 0,
      author: 'Facebook',
      description: ogDescription,
      downloadUrl,
    }
  }

  // Decode the JSON-string escaping Facebook ships in its embedded config.
  private decodeFacebookString(raw: string): string {
    return raw
      .replace(/\\u0025/g, '%')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u003D/gi, '=')
      .replace(/\\u003F/gi, '?')
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      )
      .replace(/\\/g, '')
  }

  /**
   * Primary Instagram extractor: Instagram's own web GraphQL endpoint.
   * Returns the full `shortcode_media` graph (handles photos, reels/videos
   * and multi-item carousels) without requiring a login.
   */
  private async tryInstagramGraphQL(
    shortcode: string,
    originalUrl: string,
  ): Promise<VideoData | null> {
    const variables = {
      shortcode,
      fetch_tagged_user_count: null,
      hoisted_comment_id: null,
      hoisted_reply_id: null,
    }
    const form = new URLSearchParams()
    form.append('av', '0')
    form.append('__d', 'www')
    form.append('__user', '0')
    form.append('__a', '1')
    form.append('__req', '1')
    form.append('dpr', '1')
    form.append('variables', JSON.stringify(variables))
    form.append('doc_id', '8845758582119845')

    const response = await axios.post(
      'https://www.instagram.com/graphql/query',
      form.toString(),
      {
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-IG-App-ID': this.instagramAppId,
          Accept: '*/*',
          Origin: 'https://www.instagram.com',
          Referer: `https://www.instagram.com/p/${shortcode}/`,
        },
        timeout: 20000,
      },
    )

    const media: IgShortcodeMedia | undefined =
      response.data?.data?.xdt_shortcode_media ??
      response.data?.data?.shortcode_media
    if (!media) return null
    return this.parseInstagramMedia(media, shortcode, originalUrl)
  }

  /**
   * Primary Instagram extractor: the public embed page. It is designed to be
   * publicly embeddable, so it serves a full `shortcode_media` graph (photos,
   * reels/videos and multi-item carousels) without a login. The browser-like
   * `Sec-Fetch-*` headers matter — Instagram returns 403 without them.
   *
   * First parses the rich JSON the page ships (handles carousels); otherwise
   * falls back to scraping the rendered single image/video element.
   */
  private async tryInstagramEmbed(
    shortcode: string,
    originalUrl: string,
  ): Promise<VideoData | null> {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': this.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      timeout: 20000,
    })

    const html = typeof response.data === 'string' ? response.data : ''
    if (!html) return null

    // 1) Best case: the embed page ships the full shortcode_media JSON.
    const media = this.extractEmbeddedShortcodeMedia(html)
    if (media) {
      const parsed = this.parseInstagramMedia(media, shortcode, originalUrl)
      if (parsed.downloadUrl || (parsed.images?.length ?? 0) > 0) return parsed
    }

    // 2) Fallback: scrape the rendered embed for a single image / video.
    const $ = cheerio.load(html)
    const imgSrc = $('img.EmbeddedMediaImage').attr('src')
    const videoSrc = $('video').attr('src')
    const username =
      $('.UsernameText').first().text().trim() ||
      $('.Username a').first().text().trim() ||
      'Unknown'

    if (!imgSrc && !videoSrc) return null

    return {
      id: shortcode,
      title: `Instagram post by @${username}`,
      url: originalUrl,
      thumbnail: imgSrc || '',
      duration: 0,
      author: username,
      description: '',
      downloadUrl: videoSrc || '',
      images:
        !videoSrc && imgSrc
          ? [{ id: `${shortcode}_0`, url: imgSrc, thumbnail: imgSrc }]
          : undefined,
      isPhotoCarousel: false,
    }
  }

  // Map an Instagram `shortcode_media` object onto our shared VideoData shape.
  private parseInstagramMedia(
    media: IgShortcodeMedia,
    shortcode: string,
    originalUrl: string,
  ): VideoData {
    const username = media.owner?.username || 'Unknown'
    const caption =
      media.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() || ''
    const title = caption
      ? caption.slice(0, 80).replace(/\s+/g, ' ').trim()
      : `Instagram post by @${username}`

    const images: ImageData[] = []
    let downloadUrl = ''

    const children = media.edge_sidecar_to_children?.edges
    if (Array.isArray(children) && children.length > 0) {
      // Carousel: collect every photo; the first video becomes the primary clip.
      children.forEach((edge, i) => {
        const node = edge?.node
        if (!node) return
        if (node.is_video && node.video_url) {
          if (!downloadUrl) downloadUrl = node.video_url
        } else if (node.display_url) {
          images.push({
            id: `${shortcode}_${i}`,
            url: node.display_url,
            thumbnail: node.display_resources?.[0]?.src || node.display_url,
          })
        }
      })
    } else if (media.is_video && media.video_url) {
      downloadUrl = media.video_url
    } else if (media.display_url) {
      images.push({
        id: `${shortcode}_0`,
        url: media.display_url,
        thumbnail: media.display_url,
      })
    }

    const thumbnail =
      media.display_url || media.thumbnail_src || images[0]?.thumbnail || ''

    return {
      id: shortcode,
      title,
      url: originalUrl,
      thumbnail,
      duration: Math.round(media.video_duration || 0),
      author: username,
      description: caption,
      downloadUrl,
      images: images.length > 0 ? images : undefined,
      isPhotoCarousel: false,
    }
  }

  // Pull the embedded `shortcode_media` JSON out of an embed page's HTML.
  private extractEmbeddedShortcodeMedia(
    html: string,
  ): IgShortcodeMedia | null {
    // Preferred path: the embed ships `"contextJSON":"<json-encoded-json>"`.
    // The value is a JSON-encoded string whose contents are themselves JSON,
    // so a double JSON.parse decodes every escape (quotes, slashes, \uXXXX)
    // correctly — far more robust than hand-rolled unescaping.
    const fromContext = this.extractContextJson(html)
    if (fromContext) return fromContext

    // Fallback: balance-match the raw `shortcode_media` object. Handles the
    // raw (already-unescaped) variant some payloads ship.
    const key = '"shortcode_media":'
    const keyIdx = html.indexOf(key)
    if (keyIdx !== -1) {
      const braceStart = html.indexOf('{', keyIdx + key.length)
      if (braceStart !== -1) {
        const json = this.extractBalancedJson(html, braceStart)
        if (json) {
          try {
            return JSON.parse(json) as IgShortcodeMedia
          } catch {
            // fall through
          }
        }
      }
    }
    return null
  }

  // Decode the embed page's `contextJSON` blobs and return the first that
  // contains a shortcode_media. The page can ship several contextJSON strings
  // (e.g. a NavigationMetrics telemetry one), so we scan all of them rather
  // than assuming the media blob comes first.
  private extractContextJson(html: string): IgShortcodeMedia | null {
    const key = '"contextJSON":'
    let searchFrom = 0
    while (true) {
      const idx = html.indexOf(key, searchFrom)
      if (idx === -1) break
      const quoteStart = html.indexOf('"', idx + key.length)
      if (quoteStart === -1) break

      // Read the JSON string token (respecting backslash escapes).
      let i = quoteStart + 1
      let escaped = false
      for (; i < html.length; i++) {
        const ch = html[i]
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') break
      }
      searchFrom = i + 1

      const token = html.slice(quoteStart, i + 1)
      try {
        const inner = JSON.parse(token) as string // first decode → JSON text
        const obj = JSON.parse(inner) as {
          gql_data?: { shortcode_media?: IgShortcodeMedia }
          context?: { media?: IgShortcodeMedia }
        }
        const media = obj?.gql_data?.shortcode_media || obj?.context?.media
        if (media) return media
      } catch {
        // not the media blob — try the next contextJSON occurrence
      }
    }
    return null
  }

  // Return the balanced `{...}` substring starting at `start`, respecting
  // nested braces and string literals.
  private extractBalancedJson(text: string, start: number): string | null {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return text.slice(start, i + 1)
      }
    }
    return null
  }

  private async resolveUrl(url: string): Promise<string> {
    try {
      if (
        url.includes('vm.tiktok.com') ||
        url.includes('vt.tiktok.com') ||
        url.includes('/t/')
      ) {
        const response = await axios.head(url, {
          maxRedirects: 5,
          validateStatus: () => true,
          headers: { 'User-Agent': this.userAgent },
          timeout: 10000,
        })
        return response.request.res.responseUrl || url
      }
    } catch {
      // If resolve fails, return original URL
    }
    return url
  }
}
