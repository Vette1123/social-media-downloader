import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloader, firstResult, parseTwitchClipSlug } from './downloader'
import { detectPlatform, unwrapLoginWall } from './validator'

/**
 * Pin native media off: nothing here exercises yt-dlp, and letting the gate
 * run let it spawn a real extractor process from the failure-copy tests.
 */
vi.mock('./nativeMedia', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./nativeMedia')>()),
  nativeMediaAvailable: () => false,
}))

/**
 * The platforms that have no bespoke extractor upstream of them and used to be
 * Cobalt's job. The public instance now refuses most of them, so each of these
 * reads the platform's own embed surface instead — and each surface has one
 * detail that is easy to get wrong and impossible to notice without a test:
 * Twitch's unsigned URL 401s, reddit's muxed MP4s live in an attribute past the
 * generic scanner's window, Pinterest names renditions rather than listing
 * them, and Threads answers a browser with an empty app shell.
 *
 * Reached through casts because the methods are private; the alternative is
 * asserting on a re-implementation of the parsing rather than on what ships.
 */
type PrivateDownloader = {
  tryTwitchClip(url: string): Promise<VideoDataLike | null>
  tryRedditEmbed(url: string): Promise<VideoDataLike | null>
  tryPinterestPin(url: string): Promise<VideoDataLike | null>
  tryThreadsEmbed(url: string): Promise<VideoDataLike | null>
  tryLinkedInPost(url: string): Promise<VideoDataLike | null>
  tryVimeo(url: string): Promise<VideoDataLike | null>
  downloadVideo(url: string): Promise<VideoDataLike>
  trySoundcloudTrack(url: string): Promise<VideoDataLike | null>
  resolveRedirect(url: string): Promise<string>
  parseFacebookHtml(html: string, url: string): VideoDataLike | null
  downloadFacebook(url: string): Promise<VideoDataLike>
  tryFacebookPhoto(
    resolvedUrl: string,
    originalUrl: string,
  ): Promise<VideoDataLike | null>
}
interface VideoDataLike {
  title: string
  author: string
  duration: number
  thumbnail: string
  downloadUrl: string
  embedUrl?: string
  images?: Array<{ url: string }>
}

function priv(downloader: Downloader): PrivateDownloader {
  return downloader as unknown as PrivateDownloader
}

/**
 * The SoundCloud chain reads three different hosts, so a one-answer stub
 * cannot stage it. Each route is matched in order; anything unmatched is a
 * small 404 rather than a live network call.
 */
function stubFetchRoutes(
  routes: Array<{ match: RegExp; body: string | unknown }>,
) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    for (const route of routes) {
      if (route.match.test(String(input))) {
        return new Response(
          typeof route.body === 'string' ? route.body : JSON.stringify(route.body),
          {
            headers: {
              'Content-Type':
                typeof route.body === 'string' ? 'text/html' : 'application/json',
            },
          },
        )
      }
    }
    return new Response('{"error": "not staged"}', { status: 404 })
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

/** One canned response for every request, which is all any of these make. */
function stubFetch(body: unknown, init?: ResponseInit) {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  const headers = {
    'Content-Type': typeof body === 'string' ? 'text/html' : 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(json, { ...init, headers }),
  )
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the Twitter API client', () => {
  it.each([false, true])(
    'resolves a post with possibly_sensitive=%s as an API client',
    async (sensitive) => {
      const mediaUrl = 'https://video.twimg.com/example.mp4'
      const spy = stubFetch({
        possibly_sensitive: sensitive,
        text: 'A public video',
        user_name: 'Example',
        media_extended: [
          {
            type: 'video',
            url: mediaUrl,
            thumbnail_url: 'https://pbs.twimg.com/example.jpg',
          },
        ],
      })
      const result = await new Downloader().downloadVideo(
        'https://x.com/example/status/1234567890',
      )

      expect(result.downloadUrl).toBe(mediaUrl)
      expect(result.images).toBeUndefined()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(String(spy.mock.calls[0][0])).toBe(
        'https://api.vxtwitter.com/example/status/1234567890',
      )
      const headers = new Headers(spy.mock.calls[0][1]?.headers)
      expect(headers.get('User-Agent')).toBe('SocialMediaDownloader/1.0')
      expect(headers.get('Accept')).toBe('application/json')
      expect(headers.has('Cookie')).toBe(false)
      expect(headers.has('Authorization')).toBe(false)
    },
  )
})

describe('the Twitch clip slug', () => {
  it('reads both link shapes', () => {
    expect(parseTwitchClipSlug('https://clips.twitch.tv/HappyPandaKappa-x1')).toBe(
      'HappyPandaKappa-x1',
    )
    expect(
      parseTwitchClipSlug('https://www.twitch.tv/someone/clip/HappyPandaKappa-x1'),
    ).toBe('HappyPandaKappa-x1')
  })

  /** A VOD is HLS, which this deployment cannot turn into a file. */
  it('refuses VODs and channels', () => {
    expect(parseTwitchClipSlug('https://www.twitch.tv/videos/40464143')).toBeNull()
    expect(parseTwitchClipSlug('https://www.twitch.tv/someone')).toBeNull()
  })
})

describe('the Twitch clip extractor', () => {
  const clip = {
    data: {
      clip: {
        title: 'caught lookin',
        durationSeconds: 9,
        thumbnailURL: 'https://clips-media.example/preview.jpg',
        broadcaster: { displayName: 'Streamer' },
        videoQualities: [
          { quality: '480', sourceURL: 'https://cdn.example/480.mp4' },
          { quality: '1080', sourceURL: 'https://cdn.example/1080.mp4' },
          { quality: '720', sourceURL: 'https://cdn.example/720.mp4' },
        ],
        playbackAccessToken: { signature: 'sig123', value: '{"a":1}' },
      },
    },
  }

  it('signs the highest rendition', async () => {
    stubFetch(clip)
    const result = await priv(new Downloader()).tryTwitchClip(
      'https://clips.twitch.tv/HappyPandaKappa-x1',
    )
    expect(result?.downloadUrl).toBe(
      `https://cdn.example/1080.mp4?sig=sig123&token=${encodeURIComponent('{"a":1}')}`,
    )
    expect(result?.author).toBe('Streamer')
    expect(result?.duration).toBe(9)
  })

  it('takes the smallest rendition in SD', async () => {
    stubFetch(clip)
    const result = await priv(new Downloader({ quality: 'sd' })).tryTwitchClip(
      'https://clips.twitch.tv/HappyPandaKappa-x1',
    )
    expect(result?.downloadUrl).toContain('480.mp4')
  })

  /** Without the token the URL answers 401, so a tokenless clip is no result. */
  it('returns null when no access token comes back', async () => {
    stubFetch({
      data: { clip: { ...clip.data.clip, playbackAccessToken: null } },
    })
    await expect(
      priv(new Downloader()).tryTwitchClip('https://clips.twitch.tv/x-1'),
    ).resolves.toBeNull()
  })
})

describe('the reddit embed extractor', () => {
  const packaged = {
    playbackMp4s: {
      duration: 16,
      permutations: [
        {
          source: {
            url: 'https://packaged-media.redd.it/abc/pb/m2-res_360p.mp4?s=sig',
            dimensions: { width: 288, height: 360 },
          },
        },
        {
          source: {
            url: 'https://packaged-media.redd.it/abc/pb/m2-res_1080p.mp4?s=sig',
            dimensions: { width: 864, height: 1080 },
          },
        },
      ],
    },
  }
  // The attribute is HTML-escaped and sits behind a lot of markup, exactly as
  // the live page ships it.
  const page = `<html><body>${'<div class="filler"></div>'.repeat(50)}<shreddit-player packaged-media-json="${JSON.stringify(
    packaged,
  ).replace(/"/g, '&quot;')}"></shreddit-player></body></html>`

  it('takes the tallest pre-muxed mp4', async () => {
    stubFetch(page)
    const result = await priv(new Downloader()).tryRedditEmbed(
      'https://www.reddit.com/r/oddlysatisfying/comments/1vhp8n5/taking_a_walk_in_the_rain/',
    )
    expect(result?.downloadUrl).toBe(
      'https://packaged-media.redd.it/abc/pb/m2-res_1080p.mp4?s=sig',
    )
    expect(result?.duration).toBe(16)
    expect(result?.author).toBe('r/oddlysatisfying')
    expect(result?.title).toBe('Taking a walk in the rain')
  })

  it('asks the embed host, not the post host', async () => {
    const spy = stubFetch(page)
    await priv(new Downloader()).tryRedditEmbed(
      'https://www.reddit.com/r/aww/comments/abc123/some_title/',
    )
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://embed.reddit.com/r/aww/comments/abc123/',
    )
  })

  /** An image or text post carries no packaged media; that is not an error. */
  it('returns null for a post with no muxed mp4', async () => {
    stubFetch('<html><body>no media here</body></html>')
    await expect(
      priv(new Downloader()).tryRedditEmbed(
        'https://www.reddit.com/r/aww/comments/abc123/t/',
      ),
    ).resolves.toBeNull()
  })
})

describe('the Pinterest pin extractor', () => {
  it('prefers a video rendition, tallest first', async () => {
    stubFetch({
      data: [
        {
          grid_title: 'A clip',
          pinner: { username: 'someone' },
          images: { orig: { url: 'https://i.pinimg.example/orig.jpg' } },
          videos: {
            video_list: {
              V_HLSV4: { url: 'https://v.pinimg.example/hls.m3u8', height: 1080 },
              V_720P: { url: 'https://v.pinimg.example/720.mp4', height: 720 },
              V_480P: { url: 'https://v.pinimg.example/480.mp4', height: 480 },
            },
          },
        },
      ],
    })
    const result = await priv(new Downloader()).tryPinterestPin(
      'https://www.pinterest.com/pin/214343263495052387/',
    )
    // The manifest is taller than every file and must still lose: it is not
    // something this deployment can save.
    expect(result?.downloadUrl).toBe('https://v.pinimg.example/720.mp4')
    expect(result?.author).toBe('someone')
  })

  it('falls back to the image, so a photo pin is a gallery not a failure', async () => {
    stubFetch({
      data: {
        pins: [
          {
            description: 'Baked fusilli',
            images: {
              '236x': { url: 'https://i.pinimg.example/236.jpg', height: 236 },
              '564x': { url: 'https://i.pinimg.example/564.jpg', height: 564 },
            },
          },
        ],
      },
    })
    const result = await priv(new Downloader()).tryPinterestPin(
      'https://www.pinterest.com/pin/1/',
    )
    expect(result?.downloadUrl).toBe('')
    expect(result?.images).toEqual([
      {
        id: '1_0',
        url: 'https://i.pinimg.example/564.jpg',
        thumbnail: 'https://i.pinimg.example/564.jpg',
      },
    ])
  })
})

describe('the Threads embed extractor', () => {
  const embed = `<html><head><title>Threads</title></head><body><video poster="https://cdn.example/p.jpg" src="https://cdn.example/clip.mp4"></video></body></html>`

  it('reads the embed view as a link crawler', async () => {
    const spy = stubFetch(embed)
    const result = await priv(new Downloader()).tryThreadsEmbed(
      'https://www.threads.com/@someone/post/Db-50iLEbpn/',
    )
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://www.threads.com/@someone/post/Db-50iLEbpn/embed',
    )
    const headers = spy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toContain('facebookexternalhit')
    expect(result?.downloadUrl).toBe('https://cdn.example/clip.mp4')
    expect(result?.title).toBe('Threads post by @someone')
  })
})

/**
 * LinkedIn public posts serve their media in og: tags to link crawlers, the
 * way Threads does — the app shell is a wall, the crawler view is not. Tested
 * here rather than only live because the same trap as Threads applies: a
 * browser UA sees the shell and every scrape of it comes up empty.
 */
describe('the LinkedIn post extractor', () => {
  const post = `<html><head>
    <meta property="og:title" content="Why the rollout slipped" />
    <meta property="og:image" content="https://media.example.linkedin.com/poster.jpg" />
    <meta property="og:video:secure_url" content="https://media.example.linkedin.com/dms/clip.mp4" />
  </head><body></body></html>`

  it('reads the og video off the post URL as a link crawler', async () => {
    const spy = stubFetch(post)
    const result = await priv(new Downloader()).tryLinkedInPost(
      'https://www.linkedin.com/posts/satyanadella_share-week-crew-activity-7260000000000000000-aBcD/?trk=public_post_feed-clip',
    )
    // Query is stripped (utm/trk tracking changes nothing), not sent upstream.
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://www.linkedin.com/posts/satyanadella_share-week-crew-activity-7260000000000000000-aBcD',
    )
    const headers = spy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toContain('facebookexternalhit')
    expect(result?.downloadUrl).toBe(
      'https://media.example.linkedin.com/dms/clip.mp4',
    )
    expect(result?.title).toBe('Why the rollout slipped')
    // The slug's readable half is the poster's name; the hash tail is not.
    expect(result?.author).toBe('satyanadella')
  })

  it('returns null on a post that has no video', async () => {
    stubFetch(
      '<html><head><meta property="og:title" content="Text only" /></head></html>',
    )
    expect(
      await priv(new Downloader()).tryLinkedInPost(
        'https://www.linkedin.com/posts/someone_a-plain-piece-of-text-activity-123',
      ),
    ).toBeNull()
  })

  it('returns null when the wall answers instead of the post', async () => {
    // LinkedIn's own denial answer is 999; any non-200 takes the same branch.
    stubFetch('', { status: 403 })
    expect(
      await priv(new Downloader()).tryLinkedInPost(
        'https://www.linkedin.com/feed/update/urn:li:ugcPost:7260000000000000000/',
      ),
    ).toBeNull()
  })

  /**
   * Shapes verified live: a public video post hands the anonymous og tags its
   * *cover* — media.licdn.com's /dms/image/…/videocover… path, content-type
   * image/jpeg — and the file itself never leaves the signed-in app. Serving
   * the poster as the download is the Instagram-reel trap again.
   */
  it('refuses the cover JPEG LinkedIn serves as og:video', async () => {
    stubFetch(
      `<html><head>
        <meta property="og:title" content="Why the rollout slipped" />
        <meta property="og:video:secure_url" content="https://media.licdn.com/dms/image/v2/D4E12aQH9m/gtQ/videocover-high/videocover/0/1699999999999e" />
      </head><body></body></html>`,
    )
    expect(
      await priv(new Downloader()).tryLinkedInPost(
        'https://www.linkedin.com/posts/satyanadella_share-week-crew-activity-7260000000000000000-aBcD/',
      ),
    ).toBeNull()
  })

  /**
   * A page big enough to pass the bot-wall floor (pageScrape treats anything
   * under 2 KB as a wall, which is its own pinned story) but with no media to
   * read: the shape of a SoundCloud SPA page served to a browser-fetched
   * client where the audio is HLS-only inside the player. The message must
   * name that, not "may be private".
   */
  it('says why a SoundCloud link cannot be resolved rather than failing generically', async () => {
    stubFetch(
      `<html><head><title>In the Zone</title></head><body><div>${'d'.repeat(2400)}</div></body></html>`,
    )
    await expect(
      priv(new Downloader()).downloadVideo(
        'https://soundcloud.com/artist-a/the-real-track-name',
      ),
    ).rejects.toThrow(/HLS stream through its player/)
  })

  /**
   * A clean, real-sized post page that simply publishes no file: tryLinkedInPost
   * declined (no video), Cobalt has nothing for the host, and the page itself
   * has no og:video. "May be private" is false here — the videos only go out
   * to members.
   */
  it('says why a LinkedIn video cannot be resolved rather than failing generically', async () => {
    stubFetch(
      `<html><head><title>droid</title></head><body><div>${'d'.repeat(2400)}</div></body></html>`,
    )
    await expect(
      priv(new Downloader()).downloadVideo(
        'https://www.linkedin.com/posts/satyanadella_share-week-crew-activity-7260000000000000000-aBcD/',
      ),
    ).rejects.toThrow(/signed-in members only/)
  })
})

/**
 * The three platforms newly routed to downloadGeneric. SoundCloud and
 * Dailymotion resolve through Cobalt's own service list, so recognition only
 * has to be right about shareable links — a bare profile or playlist URL
 * should fall through to generic, not claim a platform it cannot name.
 */
describe('recognising the long-tail platforms', () => {
  it.each([
    'https://soundcloud.com/artist-a/the-real-track-name',
    'https://snd.sc/aB12cD',
  ])('names %s SoundCloud', (url) => {
    expect(detectPlatform(url)).toBe('soundcloud')
  })

  it('leaves a SoundCloud profile to the generic path', () => {
    expect(detectPlatform('https://soundcloud.com/artist-a')).toBe('generic')
  })

  it.each([
    'https://www.dailymotion.com/video/x8abcde',
    'https://dai.ly/x8abcde',
  ])('names %s Dailymotion', (url) => {
    expect(detectPlatform(url)).toBe('dailymotion')
  })

  it.each([
    'https://www.linkedin.com/posts/satyanadella_share-week-crew-activity-7260000000000000000-aBcD/',
    'https://www.linkedin.com/feed/update/urn:li:ugcPost:7260000000000000000/',
    'https://lnkd.in/e-aB12cD',
  ])('names %s LinkedIn', (url) => {
    expect(detectPlatform(url)).toBe('linkedin')
  })

  it('leaves a LinkedIn profile to the generic path', () => {
    expect(detectPlatform('https://www.linkedin.com/in/satyanadella')).toBe(
      'generic',
    )
  })
})

/**
 * The SoundCloud app-API recipe, staged exactly as verified from datacenter
 * egress: the homepage carries the client id, /resolve hands over metadata
 * with media.transcodings, and a progressive transcoding's own URL (with
 * client_id + track_authorization) answers the direct file. Snipped and
 * HLS encodings must be skipped — this deployment has no player for them.
 */
describe('the SoundCloud track extractor', () => {
  const HOMEPAGE = `<html><head><title>SoundCloud</title></head><body>
    <script>window.__sc_version="1700000000"</script>
    <script>{"hydratable":"apiClient","data":{"id":"CLiEnT1234567890aBcDeFgHiJkLmNoP"},
    "hydratable":"other","data":{"id":"not-the-client"}}</script>
  </body></html>`

  const TRANS = {
    id: 293,
    title: 'In the Zone',
    duration: 181000,
    policy: 'MONETIZE',
    track_authorization: 'ta-token-0',
    artwork_url: 'https://i1.sndcdn.com/soulhack-large.jpg',
    user: { username: 'forss' },
    media: {
      transcodings: [
        {
          preset: 'hls_opus_1_0',
          format: { protocol: 'hls' },
          url: 'https://cf-media.sndcdn.com/hls-track.m3u8',
        },
        {
          preset: 'mp3_1_251k',
          snipped: true,
          format: { protocol: 'progressive' },
          url: 'https://cf-media.sndcdn.com/snippet.mp3',
        },
        {
          preset: 'mp3_1',
          format: { protocol: 'progressive' },
          url: 'https://cf-media.sndcdn.com/track.mp3?token=t9',
        },
      ],
    },
  }

  it('serves the progressive file, never the HLS playlist or a snippet', async () => {
    stubFetchRoutes([
      { match: /^https:\/\/soundcloud\.com\/$/, body: HOMEPAGE },
      { match: /api-v2\.soundcloud\.com\/resolve/, body: TRANS },
      {
        match: /track\.mp3\?token/,
        body: { url: 'https://cf-media.sndcdn.com/track.mp3?expires=1' },
      },
    ])
    const result = await priv(new Downloader()).trySoundcloudTrack(
      'https://soundcloud.com/forss/flickermood',
    )
    expect(result?.downloadUrl).toBe(
      'https://cf-media.sndcdn.com/track.mp3?expires=1',
    )
    expect(result?.title).toBe('In the Zone')
    expect(result?.author).toBe('forss')
    expect(result?.duration).toBe(181)
    expect(result?.thumbnail).toBe(
      'https://i1.sndcdn.com/soulhack-t1080x1080.jpg',
    )
  })

  it('falls through where only HLS is served, for the honest message', async () => {
    stubFetchRoutes([
      { match: /^https:\/\/soundcloud\.com\/$/, body: HOMEPAGE },
      {
        match: /api-v2\.soundcloud\.com\/resolve/,
        body: { ...TRANS, media: { transcodings: TRANS.media.transcodings[0] ? [
          TRANS.media.transcodings[0],
        ] : [] } },
      },
    ])
    await expect(
      priv(new Downloader()).downloadVideo(
        'https://soundcloud.com/forss/flickermood',
      ),
    ).rejects.toThrow(/HLS stream through its player/)
  })

  it('finds the client id in an asset bundle when the hydrate block has moved', async () => {
    const bare =
      '<html><body><script crossorigin src="https://a-v2.sndcdn.com/assets/55-db72ef36.js"></script></body></html>'
    const bundle =
      'curlIp;var api="${{},client_id:"AbCdEf0123456789012345678901234a",tradeoff:1};'
    const spy = stubFetchRoutes([
      { match: /^https:\/\/soundcloud\.com\/$/, body: bare },
      { match: /a-v2\.sndcdn\.com\/assets\/55-/, body: bundle },
      { match: /api-v2\.soundcloud\.com\/resolve/, body: TRANS },
      {
        match: /track\.mp3\?token/,
        body: { url: 'https://cf-media.sndcdn.com/track.mp3?expires=1' },
      },
    ])
    const result = await priv(new Downloader()).trySoundcloudTrack(
      'https://soundcloud.com/forss/flickermood',
    )
    expect(result?.downloadUrl).toBe(
      'https://cf-media.sndcdn.com/track.mp3?expires=1',
    )
    // The id came from the bundle, and the streaming request carried it.
    const resolveCalls = spy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/resolve'))
    expect(resolveCalls.length).toBe(1)
    expect(resolveCalls[0]).toContain('client_id=AbCdEf0123456789012345678901234a')
  })
})

/**
 * The TikTok chain races tikwm against Cobalt rather than waiting on tikwm
 * first, which is only safe if a loser's null or throw cannot end the race.
 */
describe('racing two extractors', () => {
  const after = <T,>(ms: number, value: T) => () =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

  it('answers with the faster one', async () => {
    expect(
      await firstResult([after(40, 'slow'), after(1, 'fast')]),
    ).toBe('fast')
  })

  it('waits for a winner when the other answers null or throws', async () => {
    expect(
      await firstResult([
        after(1, null),
        async () => {
          throw new Error('upstream down')
        },
        after(20, 'winner'),
      ]),
    ).toBe('winner')
  })

  it('is null only when every one of them fails', async () => {
    expect(
      await firstResult([
        after(1, null),
        async () => {
          throw new Error('upstream down')
        },
      ]),
    ).toBeNull()
  })
})

/**
 * Facebook's own share sheet produces `fb.watch/<code>` and
 * `facebook.com/share/<v|r>/<code>`, and both answer a browser user agent with
 * 400 — so the canonical URL every Facebook extractor needs was never reached.
 */
describe('the Facebook short-link resolver', () => {
  it.each([
    'https://www.facebook.com/share/r/14p4MjFM5jX/',
    'https://fb.watch/aBcDeF/',
  ])('asks for %s as a crawler, with HEAD', async (url) => {
    const spy = stubFetch('')
    await priv(new Downloader()).resolveRedirect(url)
    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('HEAD')
    expect((init.headers as Record<string, string>)['User-Agent']).toContain(
      'facebookexternalhit',
    )
  })

  /**
   * The plugin embed is the only Facebook surface that answers without a login,
   * and it ships neither og tags nor a real title — so the card's poster and
   * name have to come out of its markup, past two images that are not the
   * poster.
   */
  it('takes the poster and no title from a plugin embed', () => {
    const plugin =
      '<html><head><title>Facebook</title></head><body>' +
      '<img class="img" src="https://static.xx.fbcdn.net/rsrc.php/v4/yN/spacer.gif">' +
      '<img class="img" src="https://scontent.example.fna.fbcdn.net/v/t15.5256-10/poster.jpg?a=1&amp;b=2">' +
      '<img class="img" src="https://scontent.example.fna.fbcdn.net/v/t39.30808-1/avatar.jpg">' +
      '<script>{"hd_src":"https://video.example.fna.fbcdn.net/clip.mp4"}</script>' +
      '</body></html>'
    const result = priv(new Downloader()).parseFacebookHtml(
      plugin,
      'https://www.facebook.com/reel/1536569814605331/',
    )
    expect(result?.downloadUrl).toBe('https://video.example.fna.fbcdn.net/clip.mp4')
    expect(result?.thumbnail).toBe(
      'https://scontent.example.fna.fbcdn.net/v/t15.5256-10/poster.jpg?a=1&b=2',
    )
    // "Facebook" is the plugin page's own title, not the video's.
    expect(result?.title).toBe('Facebook Video')
  })

  it('leaves every other link on the browser path', async () => {
    const spy = stubFetch('')
    await priv(new Downloader()).resolveRedirect(
      'https://www.instagram.com/share/BAbCdEfGh12/',
    )
    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['User-Agent']).toContain(
      'Chrome',
    )
  })
})

/**
 * A share link resolved logged-out ends at Meta's login wall, so the redirect
 * follower's answer was the wall rather than the post — losing the shortcode
 * every Instagram extractor keys on and leaving Cobalt as the only path.
 */
describe('the Meta login wall', () => {
  it('returns the post the wall was hiding', () => {
    expect(
      unwrapLoginWall(
        'https://www.instagram.com/accounts/login/?next=%2Freel%2FDaBcDeFgHiJ%2F',
      ),
    ).toBe('https://www.instagram.com/reel/DaBcDeFgHiJ/')
  })

  it('accepts an absolute next on the same host', () => {
    expect(
      unwrapLoginWall(
        'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F123',
      ),
    ).toBe('https://www.facebook.com/reel/123')
  })

  it('refuses a next pointing somewhere else, which is fetched if returned', () => {
    const offsite =
      'https://www.instagram.com/accounts/login/?next=https%3A%2F%2Fevil.example%2Fx'
    expect(unwrapLoginWall(offsite)).toBe(offsite)
  })

  it.each([
    'https://www.instagram.com/reel/DaBcDeFgHiJ/',
    'https://www.instagram.com/accounts/login/',
    'not a url at all',
  ])('leaves %s alone', (url) => {
    expect(unwrapLoginWall(url)).toBe(url)
  })
})

/**
 * The link shapes Facebook actually puts on a clipboard, all of which were
 * answered with "unsupported platform" because the patterns only listed
 * /videos/, /reel/ and /watch.
 */
describe('the Facebook link shapes', () => {
  it.each([
    'https://www.facebook.com/share/p/1AbCdEfGh2/',
    'https://www.facebook.com/someone/posts/pfbid0abc123',
    'https://www.facebook.com/groups/123456/posts/7891011/',
    'https://www.facebook.com/photo/?fbid=1234567890&set=a.1',
    'https://www.facebook.com/someone/photos/a.100/12345678/',
    'https://www.facebook.com/stories/1234567890123456/',
    'https://mbasic.facebook.com/reel/1536569814605331',
    'https://m.facebook.com/watch/?v=10153231379946729',
  ])('recognises %s', (url) => {
    expect(detectPlatform(url)).toBe('facebook')
  })

  it('says why a story cannot be downloaded rather than failing generically', async () => {
    const spy = stubFetch('')
    await expect(
      priv(new Downloader()).downloadFacebook(
        'https://www.facebook.com/stories/1234567890123456/',
      ),
    ).rejects.toThrow(/logged-in account/)
    // The point of naming it: nothing is even attempted.
    expect(spy).not.toHaveBeenCalled()
  })

  it('answers a photo link with the photo', async () => {
    stubFetch(
      '<html><head><meta property="og:image" content="https://scontent.example/photo.jpg">' +
        '<meta property="og:title" content="A photo"></head><body></body></html>',
    )
    const result = await priv(new Downloader()).tryFacebookPhoto(
      'https://www.facebook.com/photo/?fbid=123',
      'https://www.facebook.com/photo/?fbid=123',
    )
    expect(result?.images).toEqual([
      {
        id: expect.any(String),
        url: 'https://scontent.example/photo.jpg',
        thumbnail: 'https://scontent.example/photo.jpg',
      },
    ])
  })

  /**
   * Every Facebook page publishes an og:image, the poster frame included — so
   * the photo path has to refuse anything that is not named as a photo, or a
   * private video resolves "successfully" as its own thumbnail.
   */
  it('refuses to answer a video link with its poster', async () => {
    const spy = stubFetch(
      '<html><head><meta property="og:image" content="https://scontent.example/poster.jpg"></head></html>',
    )
    const result = await priv(new Downloader()).tryFacebookPhoto(
      'https://www.facebook.com/reel/1536569814605331/',
      'https://www.facebook.com/reel/1536569814605331/',
    )
    expect(result).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('the Vimeo extractor', () => {
  it('offers the embed when only manifests are left', async () => {
    stubFetch({
      video: { title: 'The New Vimeo Player', duration: 62, thumbs: { base: 'https://i.example/t.jpg' } },
      request: { files: { progressive: [], hls: {}, dash: {} } },
    })
    const result = await priv(new Downloader()).tryVimeo('https://vimeo.com/76979871')
    expect(result?.downloadUrl).toBe('')
    expect(result?.embedUrl).toBe('https://player.vimeo.com/video/76979871')
    expect(result?.title).toBe('The New Vimeo Player')
  })

  it('still prefers a progressive rendition when one exists', async () => {
    stubFetch({
      video: { title: 'Clip', duration: 10, thumbs: {} },
      request: {
        files: {
          progressive: [
            { url: 'https://vod.example/540.mp4', height: 540 },
            { url: 'https://vod.example/1080.mp4', height: 1080 },
          ],
        },
      },
    })
    const result = await priv(new Downloader()).tryVimeo('https://vimeo.com/1')
    expect(result?.downloadUrl).toBe('https://vod.example/1080.mp4')
    expect(result?.embedUrl).toBeUndefined()
  })
})
