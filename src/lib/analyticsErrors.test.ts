import { describe, expect, it } from 'vitest'
import { errorMessage, failureCode, isExpectedFailure } from './analyticsErrors'

describe('failureCode', () => {
  it.each([
    ['Failed to fetch', 'network'],
    ['The operation timed out', 'timeout'],
    ['Too many requests', 'rate_limited'],
    // Every extractor's last-resort text lists guesses. Reading the word "private" in it
    // filed 147 X failures from 7 people as private (2026-11-14): no answer is not an answer.
    ['Could not download Twitter/X content. The post may be private, age-restricted, or unavailable.', 'inconclusive'],
    ['All download methods failed. TikTok might be blocking requests or the video is private.', 'inconclusive'],
    ['This post is private', 'private'],
    ['SoundCloud delivers its audio as an HLS stream through its player, which this extractor cannot repackage as a single file yet.', 'unsupported'],
    ['This site is not supported', 'unsupported'],
    ['Video unavailable', 'unavailable'],
    ['HTTP 500', 'server'],
    ['HTTP 502', 'unavailable'],
    ['HTTP 403', 'unavailable'],
    ['network error', 'network'],
    ['Instagram only serves these to a logged-in account', 'private'],
    ['LinkedIn serves its videos to signed-in members only; the public page publishes just a preview.', 'private'],
    ['video2.twimg.nom.es blocks automated requests from our servers', 'unavailable'],
    ['Failed to extract download URL', 'upstream'],
    [undefined, 'upstream'],
  ] as const)('%s → %s', (message, code) => {
    expect(failureCode(message)).toBe(code)
  })
})

describe('isExpectedFailure', () => {
  it('only our own faults become issues', () => {
    expect(isExpectedFailure('private')).toBe(true)
    expect(isExpectedFailure('inconclusive')).toBe(true)
    expect(isExpectedFailure('upstream')).toBe(false)
    expect(isExpectedFailure('server')).toBe(false)
  })
})

// "[early_rejection] [object Object]", 2026-11-12: untraceable.
describe('errorMessage on a plain-object rejection', () => {
  it('names it by its message, else its shape, never its values', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage({ message: 'quota exceeded', code: 22 })).toBe('quota exceeded')
    expect(errorMessage({ type: 'abort', token: 'secret-value' })).toBe('[Object] keys: type, token')
    expect(errorMessage({})).toBe('[Object] (no keys)')
  })
})
