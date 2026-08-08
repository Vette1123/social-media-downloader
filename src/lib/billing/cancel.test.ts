import { afterEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { SESSION_COOKIE } from '../auth/cookies'
import { handleCancel } from './cancel'

/**
 * The money path. What is asserted here is the part that cannot be checked by
 * looking at the screen: that `scheduled` is what goes to Creem, and that a
 * failure upstream leaves the row alone rather than half-written.
 */

const NOW_YEAR_END = '2027-08-08T10:22:19.000Z'

const USER = {
  id: 'user-1',
  sub_id: 'sub_OLD',
  sub_customer_id: 'cust_1',
  sub_status: 'active',
  sub_variant: 'annual',
  sub_ends_at: null,
  sub_past_due_since: null,
  sub_updated_at: null,
}

/**
 * Serves one canned `users` row to `loadSession`'s join and records every
 * statement, so the tests can assert on what was written — or that nothing was.
 * Same shape as webhook.test.ts.
 */
function fakeDb(user: Record<string, unknown> | null) {
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
        first: async () => user,
        all: async () => ({ results: user ? [user] : [] }),
        run: async () => ({}),
      }
      return stmt
    },
  }
  return { env: { DB: db as unknown as D1Database }, statements }
}

function cancelRequest(withSession = true): Request {
  return new Request('https://www.socialdownloader.space/api/billing/cancel', {
    method: 'POST',
    headers: withSession ? { Cookie: `${SESSION_COOKIE}=raw-session-value` } : {},
  })
}

function creemReplies(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 500 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function writes(statements: { sql: string; bindings: unknown[] }[]) {
  return statements.filter((s) => s.sql.startsWith('UPDATE users SET\n'))
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('handleCancel', () => {
  it('asks Creem to cancel at period end, not immediately', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env } = fakeDb(USER)
    const fetchMock = creemReplies({
      id: 'sub_OLD',
      status: 'scheduled_cancel',
      current_period_end_date: NOW_YEAR_END,
    })

    const response = await handleCancel(cancelRequest(), undefined, env)
    expect(response.status).toBe(200)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://test-api.creem.io/v1/subscriptions/sub_OLD/cancel')
    expect(init.method).toBe('POST')
    // The whole reason this endpoint exists instead of a link to the portal.
    expect(JSON.parse(init.body as string)).toEqual({
      mode: 'scheduled',
      onExecute: 'cancel',
    })
  })

  it('writes the new status and the paid-through date straight away', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env, statements } = fakeDb(USER)
    creemReplies({
      id: 'sub_OLD',
      status: 'scheduled_cancel',
      current_period_end_date: NOW_YEAR_END,
    })

    const response = await handleCancel(cancelRequest(), undefined, env)

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: 'scheduled_cancel',
      endsAt: Date.parse(NOW_YEAR_END),
      paidThrough: true,
    })
    const written = writes(statements)
    expect(written).toHaveLength(1)
    expect(written[0].bindings).toContain('scheduled_cancel')
    expect(written[0].bindings).toContain(Date.parse(NOW_YEAR_END))
    // Keyed on the primary key.
    expect(written[0].bindings.at(-1)).toBe('user-1')
  })

  /**
   * Creem's cancel reply need not expand `product`. Defaulting to monthly there
   * would offer an annual subscriber a $3 resubscribe.
   */
  it('keeps the annual variant when the reply carries no product', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env, statements } = fakeDb(USER)
    creemReplies({ id: 'sub_OLD', status: 'scheduled_cancel' })

    await handleCancel(cancelRequest(), undefined, env)

    expect(writes(statements)[0].bindings).toContain('annual')
    expect(writes(statements)[0].bindings).not.toContain('monthly')
  })

  it('leaves the row untouched when Creem refuses', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env, statements } = fakeDb(USER)
    creemReplies({ message: 'nope' }, false)

    const response = await handleCancel(cancelRequest(), undefined, env)

    expect(response.status).toBe(502)
    expect(writes(statements)).toHaveLength(0)
  })

  it('refuses a request with no session rather than cancelling somebody', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env, statements } = fakeDb(USER)
    const fetchMock = creemReplies({})

    const response = await handleCancel(cancelRequest(false), undefined, env)

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(writes(statements)).toHaveLength(0)
  })

  it('answers 404 when the account holds no subscription', async () => {
    vi.stubEnv('CREEM_API_KEY', 'creem_test_key')
    const { env } = fakeDb({ ...USER, sub_id: null })
    const fetchMock = creemReplies({})

    const response = await handleCancel(cancelRequest(), undefined, env)

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 on a deployment with no Creem key', async () => {
    vi.stubEnv('CREEM_API_KEY', '')
    const { env } = fakeDb(USER)

    const response = await handleCancel(cancelRequest(), undefined, env)
    expect(response.status).toBe(503)
  })
})
