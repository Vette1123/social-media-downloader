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

  it('matches a host regardless of the www prefix on either side', () => {
    configure([RULE])
    expect(ruleFor('https://site.example/video-abc/x/')).not.toBeNull()
    expect(ruleFor('https://www.site.example/video-abc/x/')).not.toBeNull()
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
})
