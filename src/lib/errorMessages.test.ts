import { describe, expect, it } from 'vitest'
import { failureLine, failureRetry, friendlyError } from './errorMessages'

describe('turning an extractor error into something worth reading', () => {
  it('names the common refusals', () => {
    expect(friendlyError('This account is private').title).toBe(
      'This post is private or login-only',
    )
    expect(friendlyError('HTTP 429 too many requests').title).toBe(
      'Temporarily rate-limited',
    )
    expect(friendlyError('video was deleted').title).toBe('Post unavailable')
  })

  /** A story link is diagnosable from the URL alone, before any error text. */
  it('reads an Instagram story from the link itself', () => {
    expect(
      friendlyError('', 'https://instagram.com/stories/nasa/123').title,
    ).toBe('Stories need a logged-in session')
  })

  it('never hides a novel error', () => {
    expect(friendlyError('kettle overheated').hint).toBe('kettle overheated')
  })

  /**
   * The two phrasings a dropped connection actually produces. Neither contains
   * the word "network", so both used to fall through to the generic branch and
   * put the browser's own internal wording in front of somebody.
   */
  it('recognises what a dropped connection really says', () => {
    expect(friendlyError('Failed to fetch').title).toBe('Network hiccup')
    expect(friendlyError('Load failed').title).toBe('Network hiccup')
    expect(friendlyError('TypeError: fetch failed').title).toBe('Network hiccup')
  })

  describe('being offline', () => {
    /**
     * It outranks everything the text could say: the request never left the
     * device, so nothing about the post is known. Telling somebody their link
     * might be private while their wifi is off sends them to check the wrong
     * thing entirely.
     */
    it('beats every other classification', () => {
      const offline = { online: false }
      expect(friendlyError('This account is private', undefined, offline).title)
        .toBe('You are offline')
      expect(
        friendlyError('', 'https://instagram.com/stories/nasa/1', offline).title,
      ).toBe('You are offline')
    })

    /**
     * `navigator.onLine === true` only means an interface is up — a captive
     * portal reports it too — so a truthy value must change nothing.
     */
    it('is only ever consulted in the negative', () => {
      expect(friendlyError('This account is private', undefined, { online: true }).title)
        .toBe('This post is private or login-only')
      expect(friendlyError('This account is private', undefined, {}).title)
        .toBe('This post is private or login-only')
    })
  })
})

/**
 * 14 Nov: every X failure read "Age-restricted content" and every unknown-site
 * failure "This post is private", because the server's last-resort text lists
 * those words as guesses. Two people then retried one X link ~50 times.
 */
describe('a failure nobody diagnosed', () => {
  const xCatchAll =
    'Could not download Twitter/X content. The post may be private, age-restricted, or unavailable.'

  it('says it could not tell, instead of naming the first guess', () => {
    expect(friendlyError(xCatchAll).title).toBe('We couldn’t download this one')
    expect(
      friendlyError(
        'Could not download this generic content. The post may be private, region-locked, unavailable, or not supported by our extractor.',
      ).title,
    ).toBe('We couldn’t download this one')
  })

  it('still names a definite answer', () => {
    expect(friendlyError('This video is age-restricted').title).toBe('Age-restricted content')
  })

  it('keeps the rate-limit reading when the text also says "login" or "unavailable"', () => {
    expect(friendlyError('429: rate limited, login required to continue').title).toBe(
      'Temporarily rate-limited',
    )
  })
})

describe('whether the banner offers a retry', () => {
  it('always for a passing condition, never for a malformed link, once for the rest', () => {
    expect(friendlyError('HTTP 429 too many requests').retry).toBe('yes')
    expect(friendlyError('Failed to fetch').retry).toBe('yes')
    expect(friendlyError('Invalid URL').retry).toBe('no')
    expect(friendlyError('This account is private').retry).toBe('once')
  })

  it('stops offering it, and says why, after the same link fails twice', () => {
    const raw = 'Could not download Twitter/X content. The post may be private, age-restricted, or unavailable.'
    expect(failureRetry(raw, undefined, {}, 1)).toBe(true)
    expect(failureRetry(raw, undefined, {}, 2)).toBe(false)
    expect(failureLine(raw, undefined, {}, 2)).toContain('retrying won’t change it')
    expect(failureRetry('HTTP 429 too many requests', undefined, {}, 5)).toBe(true)
    expect(failureRetry('Invalid URL', undefined, {}, 1)).toBe(false)
  })
})
