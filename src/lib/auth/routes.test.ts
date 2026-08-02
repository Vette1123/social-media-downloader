import { describe, expect, it } from 'vitest'
import type { WorkerEnv } from '../apiRoutes'
import { handleAccount, packAuthState, unpackAuthState } from './routes'
import type { UserRow } from './session'

describe('the OAuth state cookie', () => {
  it('round-trips an ordinary path', () => {
    expect(unpackAuthState(packAuthState('abc123', '/account'))).toEqual({
      state: 'abc123',
      target: '/account',
    })
  })

  it('round-trips a dotted path, which a `.` separator truncated', () => {
    expect(unpackAuthState(packAuthState('abc123', '/pro.html')).target).toBe('/pro.html')
  })

  it('round-trips a query string', () => {
    expect(unpackAuthState(packAuthState('abc123', '/account?checkout=success')).target).toBe(
      '/account?checkout=success',
    )
  })

  it('falls back to the home page for a malformed percent-sequence, rather than throwing', () => {
    expect(unpackAuthState('abc123|%E0%A4%A')).toEqual({ state: 'abc123', target: '/' })
  })

  it('reads a missing cookie as no state at all', () => {
    expect(unpackAuthState(null)).toEqual({ state: '', target: '/' })
  })
})

/** Enough of D1 for loadSession plus one write. */
function fakeDb(user: UserRow | null) {
  const statements: string[] = []
  const db = {
    prepare(sql: string) {
      statements.push(sql)
      const stmt = {
        bind: () => stmt,
        first: async () => user,
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }
      return stmt
    },
  }
  return { env: { DB: db } as unknown as WorkerEnv, statements }
}

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-uuid',
    google_sub: 'sub',
    email: 'buyer@example.com',
    created_at: 0,
    prefs: null,
    ls_subscription_id: null,
    ls_status: null,
    ls_variant: null,
    ls_renews_at: null,
    ls_ends_at: null,
    ls_past_due_since: null,
    ls_updated_at: null,
    ...overrides,
  } as UserRow
}

function deleteRequest(): Request {
  return new Request('https://example.com/api/account', {
    method: 'POST',
    headers: { Cookie: 'smd_session=raw-session-value', 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: true }),
  })
}

describe('handleAccount — deleting an account', () => {
  it('refuses while a subscription is still entitling, so it cannot be stranded', async () => {
    const { env, statements } = fakeDb(userRow({ ls_status: 'active', ls_subscription_id: '42' }))

    const response = await handleAccount(deleteRequest(), undefined, env)
    const body = (await response.json()) as { success: boolean; error?: string }

    expect(response.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/billing portal/i)
    expect(statements.some((sql) => sql.startsWith('DELETE FROM users'))).toBe(false)
  })

  it('still refuses a cancelled subscription that has paid time left', async () => {
    const { env } = fakeDb(
      userRow({ ls_status: 'cancelled', ls_ends_at: Date.now() + 86_400_000 }),
    )

    expect((await handleAccount(deleteRequest(), undefined, env)).status).toBe(409)
  })

  it('deletes once nothing is entitling', async () => {
    const { env, statements } = fakeDb(userRow({ ls_status: 'expired' }))

    const response = await handleAccount(deleteRequest(), undefined, env)

    expect(response.status).toBe(200)
    expect(statements.some((sql) => sql.startsWith('DELETE FROM users'))).toBe(true)
  })
})
