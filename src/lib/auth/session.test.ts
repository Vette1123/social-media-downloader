import { describe, expect, it } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import {
  MAX_SESSIONS,
  clearCookieHeaders,
  createSession,
  readCookie,
  sessionCookieHeaders,
  sessionsToEvict,
} from './session'

/**
 * Records every statement createSession prepares, so the tests can assert on
 * the SQL it builds without standing up a real D1.
 */
function fakeDb(existing: { id: string }[]) {
  const statements: { sql: string; bindings: unknown[] }[] = []
  const db = {
    prepare(sql: string) {
      const entry = { sql, bindings: [] as unknown[] }
      statements.push(entry)
      const stmt = {
        bind(...bindings: unknown[]) {
          entry.bindings = bindings
          return stmt
        },
        all: async () => ({ results: existing }),
        run: async () => ({}),
        first: async () => null,
      }
      return stmt
    },
  }
  return { db: db as unknown as D1Database, statements }
}

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

describe('createSession', () => {
  const NOW = 1_800_000_000_000

  it('counts only unexpired sessions against the cap', async () => {
    const { db, statements } = fakeDb([])
    await createSession(db, 'u1', NOW)

    const select = statements.find((s) => s.sql.startsWith('SELECT id FROM sessions'))
    expect(select?.sql).toContain('expires_at > ?')
    expect(select?.bindings).toEqual(['u1', NOW])
  })

  it('reclaims expired rows even when nothing is over the cap', async () => {
    const { db, statements } = fakeDb([])
    await createSession(db, 'u1', NOW)

    const remove = statements.find((s) => s.sql.startsWith('DELETE FROM sessions'))
    expect(remove?.sql).toContain('expires_at <= ?')
    expect(remove?.sql).not.toContain('id IN')
    expect(remove?.bindings).toEqual(['u1', NOW])
  })

  it('reclaims expired rows and evicts the surplus in one statement', async () => {
    const existing = Array.from({ length: MAX_SESSIONS }, (_, i) => ({ id: `s${i}` }))
    const { db, statements } = fakeDb(existing)
    await createSession(db, 'u1', NOW)

    const remove = statements.find((s) => s.sql.startsWith('DELETE FROM sessions'))
    expect(remove?.sql).toContain('expires_at <= ?')
    expect(remove?.sql).toContain('id IN (?)')
    expect(remove?.bindings).toEqual(['u1', NOW, 's0'])
  })

  it('stores only the hash, never the raw cookie value', async () => {
    const { db, statements } = fakeDb([])
    const raw = await createSession(db, 'u1', NOW)

    const insert = statements.find((s) => s.sql.startsWith('INSERT INTO sessions'))
    expect(insert?.bindings[0]).not.toBe(raw)
    expect(insert?.bindings[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(insert?.bindings).toEqual([expect.any(String), 'u1', NOW, NOW + 90 * 24 * 60 * 60 * 1000])
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
