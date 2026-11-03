import { describe, expect, it } from 'vitest'
import { failureCode, isExpectedFailure } from './analyticsErrors'

describe('failureCode', () => {
  it.each([
    ['Failed to fetch', 'network'],
    ['The operation timed out', 'timeout'],
    ['Too many requests', 'rate_limited'],
    ['The post may be private', 'private'],
    ['This site is not supported', 'unsupported'],
    ['Video unavailable', 'unavailable'],
    ['HTTP 500', 'server'],
    ['HTTP 502', 'unavailable'],
    ['HTTP 403', 'unavailable'],
    ['network error', 'network'],
    ['Instagram only serves these to a logged-in account', 'private'],
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
    expect(isExpectedFailure('upstream')).toBe(false)
    expect(isExpectedFailure('server')).toBe(false)
  })
})
