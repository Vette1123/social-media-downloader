import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { SESSION_COOKIE } from '../auth/cookies'
import { handleCheckout } from './checkout'

/**
 * This route exists to make two specific disasters unrepresentable, so those are
 * what is pinned here rather than the happy redirect:
 *
 *  - a test-keyed deployment sending a real customer to a live product, which
 *    charges a real card for a subscription the webhook cannot verify;
 *  - a purchase leaving no trace in our own database, which is what made a lost
 *    first webhook permanent.
 */

const LIVE_ANNUAL = 'prod_5UH0C3CxN8uL0HTlRCTuhG'
const TEST_ANNUAL = 'prod_4JdUh8fUcY5OpmUwFeOkd4'

const USER = { id: 'user-1' }

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

function checkoutRequest(variant = 'annual', withSession = true): Request {
  return new Request(`https://www.socialdownloader.space/api/billing/checkout?variant=${variant}`, {
    headers: withSession
      ? { Cookie: `${SESSION_COOKIE}=raw-session-value`, 'Sec-Fetch-Mode': 'navigate' }
      : { 'Sec-Fetch-Mode': 'navigate' },
  })
}

/** Writes only — `loadSession` now *reads* this column too, in its SELECT. */
function stamps(statements: { sql: string; bindings: unknown[] }[]) {
  return statements.filter((s) => s.sql.startsWith('UPDATE users SET sub_checkout_at'))
}

beforeEach(() => {
  process.env.CREEM_API_KEY = 'creem_live_abc'
})

afterEach(() => {
  delete process.env.CREEM_API_KEY
})

describe('handleCheckout', () => {
  it('sends a live key to the live product', async () => {
    const { env } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest(), undefined, env)

    expect(response.status).toBe(302)
    const location = response.headers.get('Location') ?? ''
    expect(location).toContain(LIVE_ANNUAL)
    expect(location).not.toContain('/test/')
  })

  /** The money hazard. A test key must not be able to produce a real charge. */
  it('sends a test key to the test product, never the live one', async () => {
    process.env.CREEM_API_KEY = 'creem_test_abc'
    const { env } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest(), undefined, env)

    const location = response.headers.get('Location') ?? ''
    expect(location).toContain(TEST_ANNUAL)
    expect(location).toContain('/test/')
    expect(location).not.toContain(LIVE_ANNUAL)
  })

  it('attaches the user id, which is the only binding the webhook trusts', async () => {
    const { env } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest(), undefined, env)

    const location = new URL(response.headers.get('Location') ?? '')
    expect(location.searchParams.get('metadata[user_id]')).toBe('user-1')
  })

  /** Without this the lost-first-webhook buyer is unfindable. */
  it('records the attempt before redirecting', async () => {
    const { env, statements } = fakeDb(USER)
    await handleCheckout(checkoutRequest(), undefined, env)

    const stamped = stamps(statements)
    expect(stamped).toHaveLength(1)
    expect(stamped[0].bindings[1]).toBe('user-1')
    expect(typeof stamped[0].bindings[0]).toBe('number')
  })

  it('never lets the redirect be cached, since it carries one user id', async () => {
    const { env } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest(), undefined, env)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('picks the monthly product for the monthly variant', async () => {
    const { env } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest('monthly'), undefined, env)
    expect(response.headers.get('Location')).toContain('prod_YlRkuWMTOagrCSiGSzdwU')
  })

  it('refuses a variant it does not sell, without stamping anything', async () => {
    const { env, statements } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest('lifetime'), undefined, env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain('/account?billing=')
    expect(stamps(statements)).toHaveLength(0)
  })

  it('sends a signed-out click back to the account page rather than to Creem', async () => {
    const { env, statements } = fakeDb(null)
    const response = await handleCheckout(checkoutRequest('annual', false), undefined, env)

    expect(response.headers.get('Location')).toContain('/account?billing=none')
    expect(stamps(statements)).toHaveLength(0)
  })

  it('answers a programmatic caller with JSON instead of a redirect', async () => {
    const { env } = fakeDb(null)
    const request = new Request(
      'https://www.socialdownloader.space/api/billing/checkout?variant=annual',
      { headers: { Accept: 'application/json' } },
    )
    const response = await handleCheckout(request, undefined, env)

    expect(response.status).toBe(401)
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })

  it('reports an unconfigured deployment rather than linking nowhere', async () => {
    delete process.env.CREEM_API_KEY
    const { env, statements } = fakeDb(USER)
    const response = await handleCheckout(checkoutRequest(), undefined, env)

    expect(response.headers.get('Location')).toContain('/account?billing=unavailable')
    expect(stamps(statements)).toHaveLength(0)
  })
})
