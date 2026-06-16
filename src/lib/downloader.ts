import axios from 'axios'
import * as cheerio from 'cheerio'
import { Readable } from 'node:stream'
import { VideoData, ImageData } from './types'
import {
  parseVideoId,
  detectPlatform,
  parseInstagramShortcode,
  parseYouTubeId,
} from './validator'
import { getMediaReferer } from './proxyHeaders'
import { ytdlpInfo } from './ytdlp'

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

// Instagram's GraphQL endpoint rejects requests that don't carry its anti-CSRF
// tokens (csrftoken + lsd) — it bounces them to a "Page Not Found" HTML page.
// The tokens are harvested from a homepage GET and cached briefly here to avoid
// an extra round-trip on every request. Keyed by the session cookie in use so
// switching IG_SESSIONID invalidates a stale (anonymous) token set.
let igTokenCache: {
  csrf: string
  lsd: string
  sessionKey: string
  expires: number
} | null = null

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

  // Cobalt instances, tried in order. Cobalt tunnels the media, so the URL it
  // returns plays cross-origin (unlike a raw CDN URL) — which is what makes it
  // work from datacenter hosts (Vercel) for TikTok, and as a login-free source
  // for YouTube/Twitter/Instagram/Facebook.
  //
  // The public instance is tried FIRST (it's warm and fast); a self-hosted
  // instance (set COBALT_API_URL — e.g. a free Render deploy, see deploy/cobalt/)
  // is the FALLBACK, used only when the public one fails or rate-limits. This
  // keeps a free fallback's cold-start latency and bandwidth off the hot path.
  // (Other public instances were pruned — canine.tools needs a JWT, eepy.today
  // 502s, 255x.ru has a broken cert — they only added dead timeouts.)
  private readonly cobaltInstances = [
    'https://co.otomir23.me/',
    process.env.COBALT_API_URL,
  ].filter((v): v is string => Boolean(v))

  // Public Instagram web app id — required by the GraphQL/web-API endpoints.
  // This is the same id Instagram's own web client sends and is not a secret.
  private readonly instagramAppId = '936619743392459'

  // Optional Instagram session cookie (the `sessionid` value). When set via the
  // IG_SESSIONID env var, the GraphQL extractor sends it so login-gated posts —
  // ones Instagram only serves to authenticated users — can be resolved. Public
  // posts work without it, and the extractor degrades gracefully when it's
  // absent or expired. Use a burner account: Instagram may flag an account for
  // automated access from datacenter (e.g. Vercel) IPs.
  private readonly instagramSessionId = process.env.IG_SESSIONID?.trim() || ''

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
   * YouTube extraction, in order of reliability:
   *   1. yt-dlp — runs locally from a residential IP that YouTube doesn't
   *      bot-block, so it yields real video + audio downloads.
   *   2. Cobalt — login-free public instance; works when its server isn't
   *      currently bot-blocked. Sparse metadata, so title/author/thumbnail are
   *      enriched from YouTube's public oEmbed endpoint.
   *   3. Embed fallback — when no extractor can produce a stream (e.g. on a
   *      datacenter host like Vercel), return the official embed so the video
   *      is still viewable.
   */
  private async downloadYouTube(url: string): Promise<VideoData> {
    const videoId = parseYouTubeId(url)
    // Normalise to a canonical watch URL — short/shorts/embed links confuse
    // some extractors, and oEmbed expects a standard watch URL.
    const canonical = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url

    const meta = await this.fetchYouTubeMeta(videoId, canonical)

    // 1) yt-dlp — extracts from this process's IP. Run locally / self-hosted
    //    (residential IP), YouTube doesn't bot-block it, so it succeeds where
    //    the public datacenter instances fail. Downloads stream via the
    //    dedicated /api/youtube endpoint. Returns null when the binary is
    //    unavailable (e.g. Vercel) or the video is blocked here — then we fall
    //    through to the public extractor and ultimately the embed.
    if (videoId) {
      const viaYtDlp = await this.tryYtDlpYouTube(videoId, canonical, meta)
      if (viaYtDlp) return viaYtDlp
    }

    const methods: Array<() => Promise<VideoData | null>> = [
      () => this.tryCobaltInstances(canonical),
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

    // No extractor could produce a downloadable stream — YouTube bot-blocks
    // extraction from datacenter IPs (the public Cobalt instance and the Vercel
    // deploy alike), and yt-dlp isn't available here. Rather than failing
    // outright, degrade gracefully to the official embed player so the video
    // stays viewable; the UI renders the embed and hides the (unavailable)
    // download/audio buttons. Real downloads need yt-dlp (run it locally).
    if (videoId) {
      return {
        id: videoId,
        title: meta.title || 'YouTube Video',
        url: canonical,
        thumbnail: meta.thumbnail || '',
        duration: 0,
        author: meta.author || 'YouTube',
        description: '',
        downloadUrl: '',
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      }
    }

    throw new Error(
      'Could not process this YouTube link. Please double-check the URL and try again.',
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

    // Order by reliability + cost:
    //   1. Embed page — fast, login-free, no authenticated hit; resolves the
    //      majority of public posts (and now bails rather than misrendering a
    //      video as a photo when its JSON doesn't parse).
    //   2. GraphQL — the workhorse fallback: token-authenticated, returns a
    //      definitive video_url, and (with IG_SESSIONID set) the ONLY path that
    //      resolves login-gated posts. Tried after the embed so the burner
    //      account is only used when actually needed.
    //   3. Cobalt — the datacenter-reachable fallback. Instagram's own signed
    //      video CDN URLs (from embed/GraphQL) are frequently refused with an
    //      HTTP 500/403 when re-fetched from a datacenter IP (e.g. Vercel), even
    //      though extraction succeeded — so the /api/video proxy can't stream
    //      them and the player is dead. Cobalt re-extracts the clip and hands
    //      back a URL that DOES stream from any IP, so it's the rescue path when
    //      the primary stream is unreachable here.
    const methods: Array<() => Promise<VideoData | null>> = [
      () =>
        shortcode
          ? this.tryInstagramEmbed(shortcode, url)
          : Promise.resolve(null),
      () =>
        shortcode
          ? this.tryInstagramGraphQL(shortcode, url)
          : Promise.resolve(null),
      () => this.tryCobaltInstances(resolvedUrl),
    ]

    // Hold the first video result whose stream we couldn't confirm reachable, so
    // that if no method yields a verified-playable stream we still return
    // something (preserving prior behavior) rather than failing outright.
    let unverifiedVideo: VideoData | null = null

    for (const method of methods) {
      try {
        const result = await method()
        if (!result) continue
        // IG never uses the TikTok-style slideshow render path.
        result.isPhotoCarousel = false

        if (result.downloadUrl) {
          // Confirm the video stream actually serves bytes from THIS host before
          // committing to it. Instagram's signed CDN URLs often 500/403 when
          // re-fetched from a datacenter IP (Vercel) even though extraction
          // worked — which renders a dead player. If it's unreachable, fall
          // through to the next method (ultimately Cobalt, whose URL streams
          // from any IP). Mirrors the YouTube path's reachability guard.
          if (await this.verifyStreamReachable(result.downloadUrl)) return result
          if (!unverifiedVideo) unverifiedVideo = result
          console.warn(
            'Instagram video stream unreachable from here, trying next method...',
          )
          continue
        }

        if ((result.images?.length ?? 0) > 0) return result
      } catch (e) {
        console.warn('Instagram method failed, trying next...', e)
      }
    }

    // No method produced a verified-reachable stream. If we did extract a video
    // URL (just couldn't confirm it here), return it anyway — it may still play
    // for the client, and this is no worse than the prior behavior.
    if (unverifiedVideo) return unverifiedVideo

    // Every login-free path failed. The most common cause now is a login-gated
    // post (Instagram serves these only to authenticated users); resolving them
    // requires a valid IG_SESSIONID. Surface that distinctly so the operator
    // knows whether to configure/refresh the cookie.
    if (!this.instagramSessionId) {
      console.warn(
        'Instagram extraction failed and IG_SESSIONID is not set — login-gated posts require it.',
      )
      throw new Error(
        'Could not download this Instagram post. It may be private, age-restricted, or login-only (this post requires a logged-in Instagram session).',
      )
    }
    throw new Error(
      'Could not download Instagram content. The post may be private or unavailable, or the configured Instagram session (IG_SESSIONID) may have expired.',
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
   * region-locked URLs (e.g. an LBRY mirror that 401s); worse, a Cobalt
   * instance that failed to extract a video still answers its tunnel with
   * `200 Content-Length: 0` — a status check alone passes that empty tunnel
   * through and the user ends up downloading a 0 KB file.
   *
   * So we require the probe to actually yield bytes. We stream the response and
   * read only the FIRST chunk (then tear the connection down) — confirming the
   * stream is live without buffering the whole file. (Cobalt tunnels ignore the
   * Range header and would otherwise stream the entire video into memory here,
   * and then again when the client fetches it for real.)
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
        responseType: 'stream',
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: () => true,
      })

      const stream = response.data as Readable
      const statusOk = response.status === 200 || response.status === 206
      // An explicit Content-Length: 0 is the empty-tunnel signature — reject early.
      if (!statusOk || response.headers['content-length'] === '0') {
        stream.destroy?.()
        return false
      }

      // Resolve true on the first non-empty chunk; false if the body ends empty,
      // errors, or stalls. Reading one chunk is enough — never the whole file.
      return await new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (result: boolean) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          stream.destroy?.()
          resolve(result)
        }
        const timer = setTimeout(() => finish(false), 10000)
        timer.unref?.()
        stream.on('data', (chunk: Buffer) => finish(chunk.length > 0))
        stream.on('end', () => finish(false))
        stream.on('error', () => finish(false))
      })
    } catch {
      return false
    }
  }

  private async downloadTikTok(url: string): Promise<VideoData> {
    const videoId = parseVideoId(url)
    if (!videoId) {
      throw new Error('Could not extract video ID from URL')
    }

    // Order by reliability across BOTH local and serverless (Vercel) hosts.
    //   1. tikwm — richest result (carousels, music, a non-IP-bound URL) when
    //      reachable, but it now sits behind Cloudflare and 403s from most IPs.
    //   2. Cobalt — the reliable everywhere path: it *tunnels* the media through
    //      its own server, so the URL it returns isn't bound to TikTok's signed
    //      CDN session and plays from any IP (the raw playAddr that snaptik/
    //      direct-scrape hand back 403s when re-fetched from a different host —
    //      which is exactly why TikTok broke on Vercel).
    //   3. yt-dlp — fast + reliable locally (residential IP), but unavailable on
    //      Vercel, so it sits after Cobalt and returns null there.
    //   4-6. The remaining public scrapers as last resorts (snaptik ships
    //      obfuscated JS, ssstik needs a rotating token).
    const methods = [
      () => this.tryTikwmMethod(url),
      () => this.tryTikTokCobalt(url),
      () => this.tryYtDlpTikTok(url),
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

  /**
   * yt-dlp TikTok path. Used as the reliable fallback when the public scraper
   * services fail. Probes availability/reachability via a quick info fetch
   * (which also yields title/author/thumbnail/duration); on success returns a
   * result whose video/audio point at the same-origin /api/tiktok streaming
   * endpoint, which lets yt-dlp do the actual fetch server-side (TikTok's CDN
   * URLs are signed against the extracting session and can't be replayed by the
   * plain media proxy). Returns null when yt-dlp is unavailable (e.g. Vercel) or
   * the video can't be reached here, so the next method gets a turn.
   */
  private async tryYtDlpTikTok(url: string): Promise<VideoData | null> {
    const info = await ytdlpInfo(url)
    if (!info) return null

    const encoded = encodeURIComponent(url)
    return {
      id: parseVideoId(url) || Date.now().toString(),
      title: info.title || 'TikTok Video',
      url,
      thumbnail: info.thumbnail || '',
      duration: Math.round(info.duration || 0),
      author: info.uploader || 'Unknown',
      description: info.title || '',
      downloadUrl: `/api/tiktok?url=${encoded}&kind=video`,
      musicUrl: `/api/tiktok?url=${encoded}&kind=audio`,
      isPhotoCarousel: false,
    }
  }

  /**
   * TikTok via Cobalt — the reliable path on datacenter hosts (Vercel). Cobalt
   * tunnels the media through its own server, so the returned URL plays from any
   * IP, unlike TikTok's signed CDN URLs (which 403 when re-fetched elsewhere).
   * The tunnel serves browser-friendly H.264 with range support, so it drives
   * both the preview and the download through the existing /api/video proxy.
   *
   * Cobalt's metadata is sparse (it only names the file `tiktok_<author>_<id>`),
   * so title/author/thumbnail are enriched from TikTok's public oembed endpoint.
   */
  private async tryTikTokCobalt(url: string): Promise<VideoData | null> {
    const result = await this.tryCobaltInstances(url)
    if (!result) return null

    // Recover author + numeric id from Cobalt's `tiktok_<author>_<id>` filename
    // (the title is that filename minus extension). Falls back to the URL.
    const fnMatch = result.title.match(/^tiktok_(.+)_(\d+)$/)
    const fnAuthor = fnMatch?.[1]
    const videoId = fnMatch?.[2] || parseVideoId(url) || result.id
    result.id = videoId

    const canonical = fnAuthor
      ? `https://www.tiktok.com/@${fnAuthor}/video/${videoId}`
      : url
    const meta = await this.fetchTikTokMeta(canonical)

    if (meta.title) result.title = meta.title
    else if (fnAuthor) result.title = `TikTok by @${fnAuthor}`
    if (meta.author) result.author = meta.author
    else if (fnAuthor) result.author = fnAuthor
    if (meta.thumbnail) result.thumbnail = meta.thumbnail

    return result
  }

  /**
   * TikTok title/author/thumbnail from the public oembed endpoint (no login or
   * key required). Best-effort — returns an empty object on any failure so the
   * caller keeps whatever metadata it already had.
   */
  private async fetchTikTokMeta(
    url: string,
  ): Promise<{ title?: string; author?: string; thumbnail?: string }> {
    try {
      const response = await axios.get(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          timeout: 12000,
        },
      )
      return {
        title: response.data?.title,
        author: response.data?.author_name,
        thumbnail: response.data?.thumbnail_url,
      }
    } catch {
      return {}
    }
  }

  // Try every cobalt instance in order.
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
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    // When the (self-hosted) instance requires auth, forward the key so only
    // this app can use it. No-op for the open public instance.
    if (process.env.COBALT_API_KEY) {
      headers.Authorization = `Api-Key ${process.env.COBALT_API_KEY}`
    }

    const response = await axios.post(
      baseUrl,
      { url, videoQuality: 'max', filenameStyle: 'basic' },
      { headers, timeout: 12000 },
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
   * yt-dlp YouTube path. Probes availability via a quick info fetch (which also
   * confirms the video is reachable from here); on success returns a result
   * whose video/audio point at the same-origin /api/youtube streaming endpoint
   * and whose embedUrl drives a lightweight preview (so previewing doesn't
   * trigger a full download). Returns null to fall back to the public
   * extractors when yt-dlp is unavailable or blocked.
   */
  private async tryYtDlpYouTube(
    videoId: string,
    canonical: string,
    meta: { title?: string; author?: string; thumbnail?: string },
  ): Promise<VideoData | null> {
    const info = await ytdlpInfo(canonical)
    if (!info) return null
    return {
      id: videoId,
      title: meta.title || info.title || 'YouTube Video',
      url: canonical,
      thumbnail: meta.thumbnail || info.thumbnail || '',
      duration: Math.round(info.duration || 0),
      author: meta.author || info.uploader || 'YouTube',
      description: '',
      downloadUrl: `/api/youtube?id=${videoId}&kind=video`,
      musicUrl: `/api/youtube?id=${videoId}&kind=audio`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
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
   * Harvest the anti-CSRF tokens (csrftoken + lsd) the GraphQL endpoint
   * requires, from a homepage GET. When IG_SESSIONID is configured the GET is
   * authenticated, so the returned csrftoken is bound to that session (required
   * for login-gated posts). Cached briefly to avoid an extra round-trip on
   * every request. Returns empty strings on failure — the caller still tries
   * the request (it simply won't succeed for gated posts).
   */
  private async getInstagramTokens(): Promise<{ csrf: string; lsd: string }> {
    const now = Date.now()
    if (
      igTokenCache &&
      igTokenCache.sessionKey === this.instagramSessionId &&
      igTokenCache.expires > now
    ) {
      return { csrf: igTokenCache.csrf, lsd: igTokenCache.lsd }
    }

    let csrf = ''
    let lsd = ''
    try {
      const response = await axios.get('https://www.instagram.com/', {
        headers: {
          'User-Agent': this.userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...(this.instagramSessionId
            ? { Cookie: `sessionid=${this.instagramSessionId}` }
            : {}),
        },
        timeout: 12000,
        validateStatus: () => true,
      })
      const html: string =
        typeof response.data === 'string' ? response.data : ''
      // csrftoken is set via Set-Cookie; fall back to the inline copy in the
      // page's shared-data blob.
      const setCookie = (response.headers['set-cookie'] as string[]) || []
      for (const cookie of setCookie) {
        const m = /csrftoken=([^;]+)/.exec(cookie)
        if (m) {
          csrf = m[1]
          break
        }
      }
      if (!csrf) csrf = html.match(/"csrf_token":"([^"]+)"/)?.[1] || ''
      lsd =
        html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1] ||
        html.match(/name="lsd"\s+value="([^"]+)"/)?.[1] ||
        ''
    } catch {
      // network error — return whatever we have (likely empty); the GraphQL
      // call will fail and the caller falls through to the next method.
    }

    igTokenCache = {
      csrf,
      lsd,
      sessionKey: this.instagramSessionId,
      expires: now + 5 * 60 * 1000,
    }
    return { csrf, lsd }
  }

  /**
   * Instagram extractor via Instagram's own web GraphQL endpoint. Returns the
   * full `shortcode_media` graph (handles photos, reels/videos and multi-item
   * carousels).
   *
   * Unlike the embed page, this endpoint enforces the web client's anti-CSRF
   * tokens — without a harvested csrftoken + lsd it returns a "Page Not Found"
   * HTML stub. With them it works login-free for public posts; with a valid
   * IG_SESSIONID cookie it also resolves login-gated posts (which the embed
   * serves as "broken media" and Cobalt can't fetch from a datacenter IP).
   */
  private async tryInstagramGraphQL(
    shortcode: string,
    originalUrl: string,
  ): Promise<VideoData | null> {
    const { csrf, lsd } = await this.getInstagramTokens()

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
    form.append('lsd', lsd)
    form.append('variables', JSON.stringify(variables))
    form.append('doc_id', '8845758582119845')

    const cookieParts: string[] = []
    if (this.instagramSessionId)
      cookieParts.push(`sessionid=${this.instagramSessionId}`)
    if (csrf) cookieParts.push(`csrftoken=${csrf}`)

    const response = await axios.post(
      'https://www.instagram.com/graphql/query/',
      form.toString(),
      {
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-IG-App-ID': this.instagramAppId,
          'X-FB-LSD': lsd,
          'X-CSRFToken': csrf,
          'X-ASBD-ID': '129477',
          Accept: '*/*',
          Origin: 'https://www.instagram.com',
          Referer: `https://www.instagram.com/p/${shortcode}/`,
          ...(cookieParts.length ? { Cookie: cookieParts.join('; ') } : {}),
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
      // The embed JSON marks a reel/video as is_video=true but ships NO video_url
      // (the clip loads via client JS) — only a poster display_url. parseInstagram-
      // Media refuses to emit that poster as a photo, so `parsed` comes back with
      // no downloadUrl. Defer to the GraphQL extractor (which returns the real
      // video_url) instead of returning an empty result here — and crucially, do
      // NOT fall through to the scrape fallback below, which would re-emit the
      // poster as a single photo. This is the case that misrendered reels.
      if (this.mediaContainsVideo(media) && !parsed.downloadUrl) return null
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

    // CRITICAL: Instagram video embeds ship NO usable <video src> (the clip is
    // loaded by client JS), only the poster frame as img.EmbeddedMediaImage. So
    // when the rich JSON above didn't parse, blindly returning that poster would
    // misrender a reel as a single photo. If the page carries any video marker,
    // bail to null so the caller falls through to the GraphQL extractor (which
    // returns the real video_url) instead of emitting a bogus image.
    const looksLikeVideo =
      !videoSrc &&
      (/"is_video"\s*:\s*(true|1)/.test(html) ||
        /"video_url"\s*:\s*"/.test(html) || // a real URL value, not "video_url":null
        html.includes('video_view_count') || // video-only metadata fields
        html.includes('video_duration') ||
        $('video').length > 0)
    if (looksLikeVideo) return null

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
      // A video child is added ONLY when it carries a real video_url — never via
      // its poster display_url (see the single-media note below).
      children.forEach((edge, i) => {
        const node = edge?.node
        if (!node) return
        if (node.is_video && node.video_url) {
          if (!downloadUrl) downloadUrl = node.video_url
        } else if (!node.is_video && node.display_url) {
          images.push({
            id: `${shortcode}_${i}`,
            url: node.display_url,
            thumbnail: node.display_resources?.[0]?.src || node.display_url,
          })
        }
      })
    } else if (media.is_video && media.video_url) {
      downloadUrl = media.video_url
    } else if (!media.is_video && media.display_url) {
      // Photo only. A video whose video_url is absent (the embed JSON ships
      // is_video=true with just a poster display_url) deliberately yields
      // NOTHING here — passing its poster off as a photo is exactly what
      // misrendered reels as single images. The caller detects the empty
      // result and defers to the GraphQL extractor (which returns video_url).
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

  // True when a `shortcode_media` graph is (or contains) a video. Used by the
  // embed extractor to decide whether a parse that produced no playable video
  // URL should defer to a richer extractor (GraphQL) rather than be mistaken for
  // a photo — the embed ships is_video=true with no video_url for reels/videos.
  private mediaContainsVideo(media: IgShortcodeMedia): boolean {
    if (media.is_video) return true
    const children = media.edge_sidecar_to_children?.edges
    return (
      Array.isArray(children) && children.some((edge) => Boolean(edge?.node?.is_video))
    )
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
