import { describe, expect, it } from 'vitest'
import type { WorkerEnv } from '../apiRoutes'
import { handleAccount, handleAuthCallback, packAuthState, unpackAuthState } from './routes'
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

/**
 * A callback with no usable state cookie is the common mobile failure: the
 * sign-in started in an in-app webview and Google handed the callback to
 * Chrome, or the trip through the consent and 2FA screens outlived the
 * cookie. It used to answer that with raw JSON on a blank page, which is a
 * dead end for the one person who most needs a retry button.
 */
describe('handleAuthCallback — a sign-in that cannot be completed', () => {
  // Never reached: the state check runs before anything touches the database.
  const env = { DB: {} } as unknown as WorkerEnv

  function callback(headers: Record<string, string> = {}): Request {
    return new Request('https://www.socialdownloader.space/api/auth/callback?code=x&state=y', {
      headers,
    })
  }

  it('sends a browser to the account page with a reason it can act on', async () => {
    const response = await handleAuthCallback(callback({ 'Sec-Fetch-Mode': 'navigate' }), undefined, env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://www.socialdownloader.space/account?signin=expired',
    )
  })

  it('clears the stale OAuth cookies so the retry starts clean', async () => {
    const response = await handleAuthCallback(callback({ 'Sec-Fetch-Mode': 'navigate' }), undefined, env)

    const cookies = response.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    for (const cookie of cookies) expect(cookie).toContain('Max-Age=0')
  })

  it('still answers a programmatic caller with JSON', async () => {
    const response = await handleAuthCallback(
      callback({ Accept: 'application/json' }),
      undefined,
      env,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ success: false })
  })
})

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
