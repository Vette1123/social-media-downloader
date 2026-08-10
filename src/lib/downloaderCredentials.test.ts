import { afterEach, describe, expect, it } from 'vitest'
import { Downloader } from './downloader'

/**
 * The one line that decides whether our own Instagram session leaves this
 * Worker, and the only entitlement in the codebase that touches a credential.
 *
 * It is worth a file of its own because every other guard around it is
 * advisory. The token claim can be re-issued, the grant can be set by hand, the
 * route can be refactored — but if this getter ever returns the cookie for an
 * uncredentialed instance, every anonymous visitor's Instagram resolve starts
 * carrying it, which is exactly the state this replaced.
 *
 * Reached through a cast because the getter is private: `private` is a
 * compile-time marker in TypeScript, and a boundary this load-bearing should be
 * asserted on the value that actually ships rather than on a re-implementation
 * of it in the test.
 */
function sessionIdOf(downloader: Downloader): string {
  return (downloader as unknown as { instagramSessionId: string }).instagramSessionId
}

const COOKIE = 'test-session-cookie-value'

afterEach(() => {
  delete process.env.IG_SESSIONID
})

describe('the Instagram credential gate', () => {
  it('withholds the session from a default instance', () => {
    process.env.IG_SESSIONID = COOKIE
    expect(sessionIdOf(new Downloader())).toBe('')
  })

  it('withholds it when constructed with no opts at all', () => {
    process.env.IG_SESSIONID = COOKIE
    expect(sessionIdOf(new Downloader({ quality: 'hd', mode: 'auto' }))).toBe('')
  })

  /**
   * The pairing that must never collapse into one flag. `priority` is a
   * supporter's entitlement and changes resolver ordering; the session is not
   * for sale at any price. A supporter's request is `priority` and never
   * `credentialed`, so this is the shape of every paid request that exists.
   */
  it('withholds it from a priority request', () => {
    process.env.IG_SESSIONID = COOKIE
    expect(sessionIdOf(new Downloader({ priority: true }))).toBe('')
  })

  it('attaches it only when explicitly credentialed', () => {
    process.env.IG_SESSIONID = COOKIE
    expect(sessionIdOf(new Downloader({ credentialed: true }))).toBe(COOKIE)
  })

  it('is empty when credentialed but the deployment has no session configured', () => {
    expect(sessionIdOf(new Downloader({ credentialed: true }))).toBe('')
  })

  it('trims a session pasted with surrounding whitespace', () => {
    process.env.IG_SESSIONID = `  ${COOKIE}  `
    expect(sessionIdOf(new Downloader({ credentialed: true }))).toBe(COOKIE)
  })

  /**
   * `credentialed` comes from a JSON token claim, so it can arrive as anything
   * a forged-but-unverified payload contains. The constructor compares against
   * `true` rather than testing truthiness, which is what keeps a stray
   * `"false"`, `1` or `{}` from switching the cookie on.
   */
  it.each([
    ['the string "true"', 'true'],
    ['the number 1', 1],
    ['an object', {}],
    ['undefined', undefined],
    ['null', null],
  ])('does not accept %s as credentialed', (_label, value) => {
    process.env.IG_SESSIONID = COOKIE
    const downloader = new Downloader({
      credentialed: value as unknown as boolean,
    })
    expect(sessionIdOf(downloader)).toBe('')
  })
})
