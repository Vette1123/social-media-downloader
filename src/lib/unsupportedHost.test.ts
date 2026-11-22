import { describe, expect, it } from 'vitest'
import { failureCode } from './analyticsErrors'
import { failureRetry, friendlyError } from './errorMessages'

/**
 * t.me, google.com and friends failed 66% of generic resolves and were labelled
 * "private" (PostHog, 23 days): the chain's guess list says "may be private",
 * and nobody was told the site itself is the problem.
 */
const GUESS_LIST =
  'Could not download this generic content. The post may be private, region-locked, unavailable, or not supported.'

describe('a site we cannot read', () => {
  it.each(['https://t.me/somechannel/12', 'https://www.google.com/search?q=cats'])(
    'says the site is unsupported, never private: %s',
    (url) => {
      const out = friendlyError(GUESS_LIST, url)
      expect(out.title).toBe('This site isn’t supported')
      expect(out.retry).toBe('no')
      expect(failureRetry(GUESS_LIST, url)).toBe(false)
    },
  )

  it('believes an extractor that says the site is not supported', () => {
    expect(friendlyError('This site is not supported, login required').title).toBe(
      'This site isn’t supported',
    )
  })

  it('keeps the private copy for a supported platform', () => {
    expect(
      friendlyError('This account is private', 'https://www.instagram.com/p/abc123/').title,
    ).toBe('This post is private or login-only')
  })
})

describe('failureCode on a host we do not support', () => {
  it('is unsupported, not private, when the link says why', () => {
    const msg = 'Could not download this generic content. Login required, the post may be private.'
    expect(failureCode(msg, 'https://t.me/chan/1')).toBe('unsupported')
    expect(failureCode(msg, 'https://www.instagram.com/p/abc123/')).not.toBe('unsupported')
    expect(failureCode('HTTP 429', 'https://t.me/chan/1')).toBe('rate_limited')
  })
})
