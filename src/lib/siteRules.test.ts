import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSiteRules, resolveByRule, ruleFor, siteRules } from './siteRules'

/**
 * A recipe of the shape the secret carries: the pasted URL yields an id, an
 * alternate page yields a numeric file id, and the two build a download URL at
 * whichever height actually exists.
 */
const RULE = {
  host: 'www.site.example',
  id: '/video-([A-Za-z0-9]+)/',
  page: 'https://www.site.example/embed/$1/',
  fid: '/thumbs/static\\d+/\\d+/\\d+/\\d+/(\\d+)/',
  media: 'https://www.site.example/dload/$1/{h}/$2-{h}p.mp4',
  heights: [1080, 720],
}

const PAGE = `<html><head><title>A Clip</title>
  <meta property="og:image" content="https://img.site.example/a.jpg">
  </head><body>
  <img src="https://static.site.example/thumbs/static4/1/17/171/17187864/4_360.jpg">
  </body></html>`

/** The same page with the height its own structured data would state. */
const pageWithHeight = async (): Promise<string | null> =>
  PAGE.replace('</body>', '<script type="application/ld+json">{"height": "720"}</script></body>')

const WATCH = 'https://www.site.example/video-YI0Ch192Dyi/some-slug/'

function configure(rules: unknown): void {
  vi.stubEnv('SCRAPE_SITE_RULES', JSON.stringify(rules))
  resetSiteRules()
}

/** A HEAD responder: every URL in `serving` is a file, everything else a page. */
function headMock(serving: string[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const type = serving.includes(url) ? 'video/mp4' : 'text/html; charset=utf-8'
    return new Response(null, { headers: { 'content-type': type } })
  })
}

const page = async (): Promise<string | null> => PAGE

beforeEach(() => {
  resetSiteRules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  resetSiteRules()
})

describe('siteRules parsing', () => {
  it('is empty when nothing is configured, so no host behaves differently', () => {
    vi.stubEnv('SCRAPE_SITE_RULES', '')
    resetSiteRules()
    expect(siteRules()).toEqual([])
  })

  it('survives malformed JSON rather than breaking every other site', () => {
    vi.stubEnv('SCRAPE_SITE_RULES', '[{oops')
    resetSiteRules()
    expect(siteRules()).toEqual([])
  })

  it('drops an entry missing a required field, keeping the valid ones', () => {
    configure([RULE, { host: 'x.example' }])
    expect(siteRules()).toHaveLength(1)
  })

  it('drops an entry whose optional field has the wrong type', () => {
    configure([RULE, { ...RULE, api: 42 }])
    expect(siteRules()).toHaveLength(1)
  })

  it('matches a host regardless of the www prefix on either side', () => {
    configure([RULE])
    expect(ruleFor('https://site.example/video-abc/x/')).not.toBeNull()
    expect(ruleFor('https://www.site.example/video-abc/x/')).not.toBeNull()
  })

  it('matches a subdomain of the rule host, where media and player hosts live', () => {
    configure([RULE])
    expect(ruleFor('https://cdn.site.example/video-abc/x/')).not.toBeNull()
    expect(ruleFor('https://player.site.example/abc/abc.mp4')).not.toBeNull()
  })

  it('does not match a host that merely ends in the same letters', () => {
    configure([RULE])
    expect(ruleFor('https://notsite.example/video-abc/x/')).toBeNull()
  })

  it('does not match a different host, or an unparseable URL', () => {
    configure([RULE])
    expect(ruleFor('https://other.example/video-abc/x/')).toBeNull()
    expect(ruleFor('not a url')).toBeNull()
  })
})

describe('resolveByRule', () => {
  it('builds the download URL from the id in the link and the id in the page', async () => {
    configure([RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(WATCH, page)
    expect(media?.mediaUrl).toBe(wanted)
    expect(media?.isStream).toBe(false)
  })

  it('drops to the next height when the top rendition does not exist', async () => {
    // A rendition that was never encoded answers 200 with a web page rather
    // than 404, so the content type is the only thing that tells them apart.
    configure([RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/720/17187864-720p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    expect((await resolveByRule(WATCH, page))?.mediaUrl).toBe(wanted)
  })

  it('gives up when no height serves, so the caller still reports the block', async () => {
    configure([RULE])
    vi.stubGlobal('fetch', headMock([]))
    await expect(resolveByRule(WATCH, page)).resolves.toBeNull()
  })

  it('takes the title and thumbnail from the page it did manage to read', async () => {
    configure([RULE])
    vi.stubGlobal(
      'fetch',
      headMock(['https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4']),
    )

    const media = await resolveByRule(WATCH, page)
    expect(media?.title).toBe('A Clip')
    expect(media?.thumbnail).toBe('https://img.site.example/a.jpg')
  })

  it('does nothing at all for a host with no recipe', async () => {
    configure([RULE])
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveByRule('https://elsewhere.example/v/1', page)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops when the alternate page could not be read either', async () => {
    configure([RULE])
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveByRule(WATCH, async () => null)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops when the page carries no file id, rather than building a wrong URL', async () => {
    configure([RULE])
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveByRule(WATCH, async () => '<html>nothing</html>')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('finds the id in a player link whose shape the watch pattern does not match', async () => {
    configure([RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(
      'https://player.site.example/YI0Ch192Dyi/YI0Ch192Dyi.mp4',
      page,
    )
    expect(media?.mediaUrl).toBe(wanted)
  })

  it('finds the id in an embed link, and tries the next candidate when one is not an id', async () => {
    configure([RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const fetched: string[] = []
    const media = await resolveByRule(
      'https://www.site.example/static4/YI0Ch192Dyi/',
      async (target) => {
        fetched.push(target)
        return target.includes('/embed/static4/') ? null : PAGE
      },
    )

    expect(media?.mediaUrl).toBe(wanted)
    expect(fetched).toEqual([
      'https://www.site.example/embed/static4/',
      'https://www.site.example/embed/YI0Ch192Dyi/',
    ])
  })

  it('does not invent an id from short or punctuated path segments', async () => {
    configure([RULE])
    const fetched: string[] = []
    await expect(
      resolveByRule('https://www.site.example/embed/abc/some-slug/', async (target) => {
        fetched.push(target)
        return PAGE
      }),
    ).resolves.toBeNull()
    expect(fetched).toEqual([])
  })

  it('treats a broken regex in the secret as no match, not as a crash', async () => {
    configure([{ ...RULE, id: '/video-([A-Za-z' }])
    await expect(resolveByRule(WATCH, page)).resolves.toBeNull()
  })

  it('probes at most four heights, however many the recipe lists', async () => {
    configure([{ ...RULE, heights: [2160, 1440, 1080, 720, 480, 360] }])
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)

    await resolveByRule(WATCH, page)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('probes the height the page states about itself first', async () => {
    configure([{ ...RULE, hcap: '"height":\\s*"(\\d+)"' }])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/720/17187864-720p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    expect((await resolveByRule(WATCH, pageWithHeight))?.mediaUrl).toBe(wanted)
  })

  it('returns the stated height unverified when every probe answered with a page', async () => {
    // A host that walls our address answers the media HEAD with the same wall
    // it serves for the page — 200, text/html — so no ladder can be verified
    // from here. The page's own height is the answer the recipe would have
    // built anyway; refusing it would turn a working link into the block
    // message.
    configure([{ ...RULE, hcap: '"height":\\s*"(\\d+)"' }])
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)

    const media = await resolveByRule(WATCH, pageWithHeight)
    expect(media?.mediaUrl).toBe(
      'https://www.site.example/dload/YI0Ch192Dyi/720/17187864-720p.mp4',
    )
  })

  it('still gives up when there is no stated height and no probe serves', async () => {
    configure([RULE])
    vi.stubGlobal('fetch', headMock([]))
    await expect(resolveByRule(WATCH, page)).resolves.toBeNull()
  })
})

describe('player API recipes', () => {
  const API_RULE = {
    ...RULE,
    hash: "player\\.hash\\s*=\\s*'([0-9a-f]+)'",
    hashFormat: 'base36',
    api: 'https://www.site.example/xhr/video/$1?hash={hash}&_={ts}',
  }

  const API_PAGE = PAGE.replace(
    '</body>',
    "<script>player.hash = 'f0b823db7573337c77e54205126dcd6f';</script></body>",
  )

  const API_BODY = JSON.stringify({
    sources: {
      mp4: {
        '720p HD': { src: 'https://cdn.site.example/v6/a/1-720p.mp4' },
        '480p': { src: 'https://cdn.site.example/v6/a/1-480p.mp4' },
      },
    },
  })

  const readBoth = (body = API_BODY) => async (target: string): Promise<string | null> => {
    if (target.includes('/embed/')) return API_PAGE
    if (target.includes('/xhr/video/')) return body
    return null
  }

  it('asks the player API with the re-encoded token, and returns its first serving source', async () => {
    configure([API_RULE])
    const wanted = 'https://cdn.site.example/v6/a/1-720p.mp4'
    const fetchMock = headMock([wanted])
    vi.stubGlobal('fetch', fetchMock)

    const asked: string[] = []
    const media = await resolveByRule(WATCH, async (target) => {
      asked.push(target)
      return readBoth()(target)
    })

    expect(media?.mediaUrl).toBe(wanted)
    expect(asked).toHaveLength(2)
    expect(asked[0]).toBe('https://www.site.example/embed/YI0Ch192Dyi/')
    expect(asked[1]).toMatch(
      /^https:\/\/www\.site\.example\/xhr\/video\/YI0Ch192Dyi\?hash=1ush7ffwl6b98x9lpmt542xdb&_=\d+$/,
    )
    // One probe, on the source the API named first: the ladder never runs.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the title and thumbnail from the page that carried the token', async () => {
    configure([API_RULE])
    vi.stubGlobal('fetch', headMock(['https://cdn.site.example/v6/a/1-720p.mp4']))

    const media = await resolveByRule(WATCH, readBoth())
    expect(media?.title).toBe('A Clip')
    expect(media?.thumbnail).toBe('https://img.site.example/a.jpg')
  })

  it('falls back to the ladder when no API source serves', async () => {
    configure([API_RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(WATCH, readBoth())
    expect(media?.mediaUrl).toBe(wanted)
  })

  it('falls back to the ladder when the API cannot be read', async () => {
    configure([API_RULE])
    const wanted = 'https://www.site.example/dload/YI0Ch192Dyi/1080/17187864-1080p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(WATCH, async (target) =>
      target.includes('/embed/') ? API_PAGE : null,
    )
    expect(media?.mediaUrl).toBe(wanted)
  })

  it('resolves a relative source against the API URL', async () => {
    configure([API_RULE])
    const wanted = 'https://www.site.example/v/1.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(
      WATCH,
      readBoth(JSON.stringify({ sources: { mp4: { src: '/v/1.mp4' } } })),
    )
    expect(media?.mediaUrl).toBe(wanted)
  })

  it('honours a rule that names a different source field', async () => {
    configure([{ ...API_RULE, src: '"file"\\s*:\\s*"([^"]+)"' }])
    const wanted = 'https://cdn.site.example/v/1.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const media = await resolveByRule(
      WATCH,
      readBoth(JSON.stringify({ file: wanted, src: 'https://cdn.site.example/v/wrong.mp4' })),
    )
    expect(media?.mediaUrl).toBe(wanted)
  })

  it('passes a non-hex token through instead of mangling it', async () => {
    configure([{ ...API_RULE, hash: "player\\.hash\\s*=\\s*'([^']+)'" }])
    // Without this stub the media HEAD probe went to the real network and timed out at 5 s now and then.
    const fetchMock = headMock([])
    vi.stubGlobal('fetch', fetchMock)
    const asked: string[] = []
    await resolveByRule(WATCH, async (target) => {
      asked.push(target)
      if (target.includes('/embed/')) {
        return API_PAGE.replace('f0b823db7573337c77e54205126dcd6f', 'zzzz-token')
      }
      return null
    })

    expect(asked[1]).toContain('hash=zzzz-token&')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('prefers the player id the page states over the one in the path', async () => {
    configure([{ ...API_RULE, vid: "player\\.vid\\s*=\\s*'([A-Za-z0-9]+)'" }])
    const wanted = 'https://cdn.site.example/v6/a/1-720p.mp4'
    vi.stubGlobal('fetch', headMock([wanted]))

    const asked: string[] = []
    const media = await resolveByRule(
      'https://www.site.example/hd-porn/18976060/a-slug/',
      async (target) => {
        asked.push(target)
        if (target.includes('/embed/')) {
          return API_PAGE.replace(
            '</body>',
            "<script>player.vid = 'wPmkEKkBUoM';</script></body>",
          )
        }
        if (target.includes('/xhr/video/')) return API_BODY
        return null
      },
    )

    expect(media?.mediaUrl).toBe(wanted)
    expect(asked[0]).toBe('https://www.site.example/embed/18976060/')
    expect(asked[1]).toContain('/xhr/video/wPmkEKkBUoM?')
  })
})
