import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Instagram story routing.
 *
 * Stories are the one Instagram shape that the `ig` grant is *required* for, so
 * a regression here is invisible to every anonymous test — it only shows up for
 * the handful of accounts that carry the grant. On 2026-08-15 exactly that
 * happened: the path resolved `username -> user id` through `web_profile_info`,
 * which answers 429 under any real use, so every `/stories/<user>/<pk>/` link
 * failed with "could not resolve that Instagram account" while highlight links
 * — which never need a username — kept working.
 *
 * The fix is to notice that a story link already carries the item's own media
 * id. These tests pin that: the pk route must not touch a username lookup at
 * all, and when it does have to fall back, it must not fall back onto the
 * endpoint that caused this.
 */

const requested: string[] = []
let responder: (url: string) => unknown = () => ({})

vi.mock('./httpClient', () => ({
  http: {
    get: vi.fn(async (url: string) => {
      requested.push(url)
      return { status: 200, data: responder(url), headers: {} }
    }),
    post: vi.fn(async (url: string) => {
      requested.push(url)
      return { status: 200, data: responder(url), headers: {} }
    }),
  },
}))

const { Downloader } = await import('./downloader')

const STORY_PK = '3963591788455603283'
const USER_ID = '44734399045'
const VIDEO = 'https://cdn.example/story.mp4'
const IMAGE = 'https://cdn.example/story.jpg'

const storyItem = {
  pk: STORY_PK,
  user: { username: 'canvaindia' },
  video_versions: [{ url: VIDEO }],
  image_versions2: { candidates: [{ url: IMAGE }] },
  video_duration: 12.4,
}

function asked(fragment: string): boolean {
  return requested.some((url) => url.includes(fragment))
}

beforeEach(() => {
  requested.length = 0
  process.env.IG_SESSIONID = 'test-session-cookie-value'
})

afterEach(() => {
  delete process.env.IG_SESSIONID
  responder = () => ({})
})

describe('a story link that carries the item id', () => {
  it('reads the item directly and never looks the account up', async () => {
    responder = (url) =>
      url.includes(`/media/${STORY_PK}/info/`) ? { items: [storyItem] } : {}

    const result = await new Downloader({
      credentialed: true,
    }).downloadVideo(`https://www.instagram.com/stories/canvaindia/${STORY_PK}/`)

    expect(result.downloadUrl).toBe(VIDEO)
    expect(result.author).toBe('canvaindia')
    expect(result.duration).toBe(12)
    expect(asked(`/media/${STORY_PK}/info/`)).toBe(true)
    // The whole point: neither lookup endpoint is touched on this path.
    expect(asked('web_profile_info')).toBe(false)
    expect(asked('topsearch')).toBe(false)
    expect(asked('reels_media')).toBe(false)
  })

  it('falls back to the reel, resolving the username without web_profile_info', async () => {
    responder = (url) => {
      if (url.includes('/media/')) return {} // item route misses
      if (url.includes('topsearch')) {
        return {
          users: [
            { user: { username: 'canvaindia_fan', pk: '999' } },
            { user: { username: 'CanvaIndia', pk: USER_ID } },
          ],
        }
      }
      if (url.includes('reels_media')) {
        return {
          reels: {
            [USER_ID]: {
              user: { username: 'canvaindia' },
              items: [{ ...storyItem, video_versions: [] }],
            },
          },
        }
      }
      return {}
    }

    const result = await new Downloader({
      credentialed: true,
    }).downloadVideo(`https://www.instagram.com/stories/canvaindia/${STORY_PK}/`)

    expect(result.images?.[0]?.url).toBe(IMAGE)
    expect(asked('web_profile_info')).toBe(false)
    expect(asked(`reel_ids=${USER_ID}`)).toBe(true)
  })

  it('takes the exact username from search, never a near match', async () => {
    responder = (url) => {
      if (url.includes('/media/')) return {}
      if (url.includes('topsearch')) {
        return { users: [{ user: { username: 'canvaindia_fan', pk: '999' } }] }
      }
      return {}
    }

    await expect(
      new Downloader({ credentialed: true }).downloadVideo(
        `https://www.instagram.com/stories/canvaindia/${STORY_PK}/`,
      ),
    ).rejects.toThrow(/Could not resolve that Instagram account/)
    expect(asked('reel_ids=999')).toBe(false)
  })
})

describe('a highlight link', () => {
  it('goes straight to the reel by highlight id', async () => {
    responder = (url) =>
      url.includes('reels_media')
        ? {
            reels: {
              'highlight:18056801944028464': {
                user: { username: 'leomessi' },
                items: [storyItem],
              },
            },
          }
        : {}

    const result = await new Downloader({ credentialed: true }).downloadVideo(
      'https://www.instagram.com/stories/highlights/18056801944028464/',
    )

    expect(result.downloadUrl).toBe(VIDEO)
    expect(asked('highlight%3A18056801944028464')).toBe(true)
    expect(asked('web_profile_info')).toBe(false)
    expect(asked('topsearch')).toBe(false)
  })
})

describe('an uncredentialed story request', () => {
  it('sends nothing at all', async () => {
    await expect(
      new Downloader().downloadVideo(
        `https://www.instagram.com/stories/canvaindia/${STORY_PK}/`,
      ),
    ).rejects.toThrow(/logged-in account/)
    expect(requested).toHaveLength(0)
  })
})
