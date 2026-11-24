import { afterEach, describe, expect, it, vi } from 'vitest'
import { failureCode } from './analyticsErrors'
import { resolveFailure } from './apiRoutes'
import { unwrapLoginWall } from './validator'
import {
  Downloader,
  FACEBOOK_SHARE_WALLED,
  FACEBOOK_STORY,
  isWalledFacebookShare,
  landedFailure,
} from './downloader'

/**
 * A Facebook share link to a post Facebook opens only for logged-in viewers
 * answers the link crawler with 200 and a "log in to view" page, and never
 * names the post. 23 visitors in a week got four failed extractors and a
 * "may be private" guess for it. These pin the honest, immediate answer, and
 * that a network failure is never mistaken for it.
 */
const SHARE = 'https://www.facebook.com/share/r/15JaCNTNva/'

type WithFacebook = { downloadFacebook(url: string): Promise<unknown> }
const facebook = (d: Downloader) => d as unknown as WithFacebook

/** A Response that reports `finalUrl` as where the redirect walk ended. */
const answer = (finalUrl: string, status = 200) => {
  const res = new Response(status === 200 ? '' : null, { status })
  Object.defineProperty(res, 'url', { value: finalUrl })
  return res
}

describe('isWalledFacebookShare', () => {
  it('is true when the walk stayed on the share link or ended at a bare login page', () => {
    expect(isWalledFacebookShare(SHARE)).toBe(true)
    expect(isWalledFacebookShare('https://m.facebook.com/share/v/1Esai9Pphz/?wtsid=rdr_0')).toBe(true)
    expect(isWalledFacebookShare('https://fb.watch/abc123/')).toBe(true)
    expect(isWalledFacebookShare('https://www.facebook.com/login/')).toBe(true)
    expect(isWalledFacebookShare('https://www.facebook.com/login.php?next=x')).toBe(true)
  })

  it('is false once the walk named a post', () => {
    expect(isWalledFacebookShare('https://www.facebook.com/reel/1365309657880490/?rdid=q')).toBe(false)
    expect(isWalledFacebookShare('https://www.facebook.com/okgo/videos/1755864954920657/')).toBe(false)
    expect(isWalledFacebookShare('https://www.facebook.com/loginapproved/videos/1/')).toBe(false)
  })
})

describe('downloadFacebook on a walled share link', () => {
  afterEach(() => vi.restoreAllMocks())

  it('says why at once, after one request, and files it as private', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => answer(SHARE))

    await expect(facebook(new Downloader()).downloadFacebook(SHARE)).rejects.toThrow(
      FACEBOOK_SHARE_WALLED,
    )
    expect(spy).toHaveBeenCalledTimes(1)
    expect(failureCode(FACEBOOK_SHARE_WALLED)).toBe('private')
  })

  it('does not blame the post when Facebook never answered', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const error = await facebook(new Downloader())
      .downloadFacebook(SHARE)
      .catch((e: Error) => e)
    expect((error as Error).message).not.toBe(FACEBOOK_SHARE_WALLED)
  })

  it('does not blame the post on an error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => answer(SHARE, 429))

    const error = await facebook(new Downloader())
      .downloadFacebook(SHARE)
      .catch((e: Error) => e)
    expect((error as Error).message).not.toBe(FACEBOOK_SHARE_WALLED)
  })
})

/**
 * #67/#69: a share link Facebook answered (3-7 s, under the 12 s hop timeout)
 * and every extractor then failed on. The event named only the pasted
 * `/share/r/*`, so the post form that failed could never be reproduced.
 */
describe('landedFailure', () => {
  it('says where a share link landed, as a shape that names no post', async () => {
    const error = landedFailure(
      'Could not download this Facebook video.',
      SHARE,
      'https://www.facebook.com/someone.page/videos/123456789/?mibextid=abc'
    )
    expect(error.landed).toBe('www|/*/videos/#?mibextid')
    const body = await resolveFailure(error, 'x').json()
    expect(body.landed).toBe('www|/*/videos/#?mibextid')
    expect(JSON.stringify(body)).not.toMatch(/someone|123456789|abc/)
  })

  it('stays a plain 422 extraction failure', () => {
    const error = landedFailure('Could not download this Facebook video.', SHARE, 'https://www.facebook.com/reel/1/')
    expect(resolveFailure(error, 'x').status).toBe(422)
  })

  it('adds nothing when the link never moved', async () => {
    const reel = 'https://www.facebook.com/reel/1536569814605331/'
    const body = await resolveFailure(landedFailure('nope', reel, reel), 'x').json()
    expect(body).toEqual({ success: false, error: 'nope' })
  })
})

/**
 * 2026-11-24, a real link: facebook.com/share/1FvT4oZ33v/ answers crawlers with
 * a 302 to /stories/<id>/…, which 302s to /login.php?next=<that story>. The
 * walk stopped at login.php and the visitor read "friends-only or deleted".
 */
const STORY =
  'https://www.facebook.com/stories/1769969363073584/UzpfSVNDOjE2NzczNTQ0MDA0Njg2NDA=/?view_single=1'
const STORY_WALL = `https://www.facebook.com/login.php?next=${encodeURIComponent(STORY)}`

describe('a share link that leads to a story', () => {
  afterEach(() => vi.restoreAllMocks())

  it("reads the story behind Facebook's login.php wall", () => {
    expect(unwrapLoginWall(STORY_WALL)).toBe(STORY)
    const bare = 'https://www.facebook.com/login.php'
    expect(unwrapLoginWall(bare)).toBe(bare)
    const offsite = 'https://www.facebook.com/login.php?next=https%3A%2F%2Fevil.example%2F'
    expect(unwrapLoginWall(offsite)).toBe(offsite)
  })

  it('says it is a story, after one request', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => answer(STORY_WALL))
    await expect(
      facebook(new Downloader()).downloadFacebook('https://www.facebook.com/share/1FvT4oZ33v/')
    ).rejects.toThrow(FACEBOOK_STORY)
    expect(spy).toHaveBeenCalledTimes(1)
    // An expected refusal, never an extractor fault on the error board.
    expect(failureCode(FACEBOOK_STORY)).toBe('private')
  })

  it('keeps the walled answer for a share link that stays on /share/', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      answer(`https://www.facebook.com/login.php?next=${encodeURIComponent(SHARE)}`)
    )
    await expect(facebook(new Downloader()).downloadFacebook(SHARE)).rejects.toThrow(
      FACEBOOK_SHARE_WALLED
    )
  })
})
