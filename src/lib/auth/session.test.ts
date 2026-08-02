import { describe, expect, it } from 'vitest'
import {
  MAX_SESSIONS,
  clearCookieHeaders,
  readCookie,
  sessionCookieHeaders,
  sessionsToEvict,
} from './session'

describe('sessionsToEvict', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))

  it('evicts nothing when there is room for one more', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS - 1))).toEqual([])
  })

  it('evicts the oldest when the cap is already reached', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS))).toEqual(['s0'])
  })

  it('evicts enough to leave room after a backlog', () => {
    expect(sessionsToEvict(rows(MAX_SESSIONS + 2))).toEqual(['s0', 's1', 's2'])
  })

  it('evicts nothing for a first-time user', () => {
    expect(sessionsToEvict([])).toEqual([])
  })
})

describe('readCookie', () => {
  it('returns null with no cookie header at all', () => {
    expect(readCookie(null, 'smd_session')).toBeNull()
  })

  it('reads a lone cookie', () => {
    expect(readCookie('smd_session=abc', 'smd_session')).toBe('abc')
  })

  it('reads a cookie from the middle of a list', () => {
    expect(readCookie('a=1; smd_session=abc; b=2', 'smd_session')).toBe('abc')
  })

  it('does not match a name that merely ends with the target', () => {
    expect(readCookie('not_smd_session=abc', 'smd_session')).toBeNull()
  })

  it('returns null for a name that is absent', () => {
    expect(readCookie('a=1; b=2', 'smd_session')).toBeNull()
  })
})

describe('cookie headers', () => {
  it('marks the session cookie httpOnly and same-site', () => {
    const [session] = sessionCookieHeaders('abc', 60)
    expect(session).toContain('smd_session=abc')
    expect(session).toContain('HttpOnly')
    expect(session).toContain('Secure')
    expect(session).toContain('SameSite=Lax')
    expect(session).toContain('Max-Age=60')
  })

  it('leaves the hint cookie readable by scripts', () => {
    const [, hint] = sessionCookieHeaders('abc', 60)
    expect(hint).toContain('smd_account=1')
    expect(hint).not.toContain('HttpOnly')
  })

  it('expires both cookies on clear', () => {
    const headers = clearCookieHeaders()
    expect(headers).toHaveLength(2)
    for (const header of headers) expect(header).toContain('Max-Age=0')
  })
})
