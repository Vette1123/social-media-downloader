import { describe, expect, it } from 'vitest'
import { errorMessage, failureCode, isExpectedFailure } from './analyticsErrors'
import {
  TELEGRAM_MEDIA_NOT_EMBEDDED,
  TELEGRAM_POST_NOT_FOUND,
  TELEGRAM_POST_TEXT_ONLY,
  TELEGRAM_PRIVATE_CHANNEL,
} from './telegramPost'

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
    // A media host's own non-standard refusal (2026-11-25, iOS, generic host): not ours.
    ['[download:video] HTTP 470', 'unavailable'],
    ['HTTP 444', 'unavailable'],
    // Standard 4xx we could cause ourselves stay faults.
    ['HTTP 400', 'upstream'],
    ['HTTP 405', 'upstream'],
    ['network error', 'network'],
    ['Instagram only serves these to a logged-in account', 'private'],
    ['LinkedIn serves its videos to signed-in members only; the public page publishes just a preview.', 'private'],
    ['video2.twimg.nom.es blocks automated requests from our servers', 'unavailable'],
    // Chrome Android lost the blob's temp file before the save (2026-11-20, 01a19180).
    ['The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.', 'device'],
    ['QuotaExceededError: The quota has been exceeded.', 'device'],
    // A provider's API quota is OUR fault, not the visitor's disk.
    ['API quota exceeded for this key', 'upstream'],
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

describe('Telegram explanations', () => {
  // Each is a diagnosis we show the visitor, never a fault of ours. MEDIA_NOT_EMBEDDED
  // matched no rule and opened an Error Tracking issue (2026-11-20, 01a18e22).
  it.each([
    [TELEGRAM_PRIVATE_CHANNEL, 'private'],
    [TELEGRAM_POST_NOT_FOUND, 'private'],
    [TELEGRAM_POST_TEXT_ONLY, 'unsupported'],
    [TELEGRAM_MEDIA_NOT_EMBEDDED, 'unavailable'],
  ] as const)('%s → %s', (message, code) => {
    expect(failureCode(message)).toBe(code)
    expect(isExpectedFailure(failureCode(message))).toBe(true)
  })
})
