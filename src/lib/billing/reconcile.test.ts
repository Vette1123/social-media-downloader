import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import {
  RECONCILE_COOLDOWN_MS,
  RECONCILE_STALE_MS,
  needsReconcile,
  reconcileSubscription,
} from './reconcile'

const NOW = 1_800_000_000_000

describe('needsReconcile', () => {
  it('is false for a user who never subscribed', () => {
    expect(needsReconcile({ ls_subscription_id: null, ls_updated_at: null }, NOW, false)).toBe(false)
  })

  it('is false for a freshly updated row', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW - 1000 }
    expect(needsReconcile(row, NOW, false)).toBe(false)
  })

  it('is true once the row is stale', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW - RECONCILE_STALE_MS - 1 }
    expect(needsReconcile(row, NOW, false)).toBe(true)
  })

  it('is true for a subscription that has never been stamped', () => {
    expect(needsReconcile({ ls_subscription_id: 'sub_1', ls_updated_at: null }, NOW, false)).toBe(true)
  })

  it('is true when forced, even on a fresh row', () => {
    const row = { ls_subscription_id: 'sub_1', ls_updated_at: NOW }
    expect(needsReconcile(row, NOW, true)).toBe(true)
  })

  it('is true when forced with no subscription id — that is the case it exists for', () => {
    // Only a webhook writes ls_subscription_id, so the user whose first webhook
    // was lost is exactly the user with none. `reconcileSubscription` finds
    // theirs by customer; the outbound call is bounded by the cooldown, not here.
    expect(needsReconcile({ ls_subscription_id: null, ls_updated_at: null }, NOW, true)).toBe(true)
  })
})

/** Same recording fake as auth/session.test.ts, plus a canned row. */
function fakeDb(row: Record<string, unknown> | null) {
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
        all: async () => ({ results: row ? [row] : [] }),
        first: async () => row,
        run: async () => ({}),
      }
      return stmt
    },
  }
  return { db: db as unknown as D1Database, statements }
}

const SUBSCRIPTION = {
  id: 'sub_new',
  object: 'subscription',
  status: 'active',
  product: { id: 'prod_m', name: 'Pro Monthly' },
  customer: { id: 'cust_1', email: 'paid@example.com' },
  next_transaction_date: '2026-09-02T00:00:00.000Z',
  current_period_end_date: null,
  updated_at: '2026-08-02T00:00:00.000Z',
}

const PENDING_ROW = {
  id: 'u1',
  ls_customer_id: null,
  ls_updated_at: null,
  ls_past_due_since: null,
  ls_reconciled_at: null,
}

/**
 * Answers by path, because the lost-first-webhook repair is two hops: the
 * address resolves to a customer, and the customer to their subscriptions.
 */
function stubFetch(routes: { customer?: unknown; search?: unknown; byId?: unknown }) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    const pick = () => {
      if (href.includes('/customers?')) return routes.customer
      if (href.includes('/subscriptions/search')) return routes.search
      return routes.byId
    }
    return new Response(JSON.stringify(pick() ?? null), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const writeOf = (statements: { sql: string; bindings: unknown[] }[]) =>
  statements.find((s) => s.sql.includes('ls_status = ?'))

describe('reconcileSubscription', () => {
  const previous = process.env.CREEM_API_KEY

  beforeEach(() => {
    process.env.CREEM_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.CREEM_API_KEY = previous
    vi.unstubAllGlobals()
  })

  it('finds a forced reconcile via the customer when the row has no subscription id', async () => {
    const fetchMock = stubFetch({
      customer: { id: 'cust_1' },
      search: { items: [SUBSCRIPTION] },
    })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.creem.io/v1/customers?email=paid%40example.com',
    )
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://api.creem.io/v1/subscriptions/search?customer_id=cust_1',
    )

    // The subscription is adopted onto the row, keyed on the primary key.
    const write = writeOf(statements)
    expect(write?.sql).toContain('WHERE id = ?')
    expect(write?.bindings[0]).toBe('sub_new')
    expect(write?.bindings[1]).toBe('cust_1')
    expect(write?.bindings[2]).toBe('active')
    expect(write?.bindings.at(-1)).toBe('u1')
  })

  it('skips the email lookup when the row already knows its customer', async () => {
    const fetchMock = stubFetch({ search: { items: [SUBSCRIPTION] } })
    const { db } = fakeDb({ ...PENDING_ROW, ls_customer_id: 'cust_known' })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.creem.io/v1/subscriptions/search?customer_id=cust_known',
    )
  })

  it('stamps the cooldown before it calls Creem', async () => {
    stubFetch({ customer: { id: 'cust_1' }, search: { items: [SUBSCRIPTION] } })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    const stamp = statements.find((s) => s.sql.includes('ls_reconciled_at = ?'))
    expect(stamp?.bindings).toEqual([NOW, 'u1'])
  })

  it('spends no Creem call while the cooldown is live', async () => {
    // ?reconcile=1 is a client-controlled flag: the checkout poll alone sends
    // fifteen of these in thirty seconds.
    const fetchMock = stubFetch({ customer: { id: 'cust_1' }, search: { items: [SUBSCRIPTION] } })
    const { db } = fakeDb({ ...PENDING_ROW, ls_reconciled_at: NOW - RECONCILE_COOLDOWN_MS + 1 })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still refreshes an existing subscription by id, in one call', async () => {
    const fetchMock = stubFetch({ byId: SUBSCRIPTION })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, 'sub_new', NOW)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.creem.io/v1/subscriptions?subscription_id=sub_new',
    )
    const lookup = statements[0]
    expect(lookup?.sql).toContain('WHERE ls_subscription_id = ?')
    expect(writeOf(statements)?.bindings[2]).toBe('active')
  })

  /**
   * A test key is routed to a different host entirely, and a test key sent to
   * production is rejected — so the host has to follow the key rather than a
   * second setting someone can forget to flip.
   */
  it('routes a test key to the test host', async () => {
    process.env.CREEM_API_KEY = 'creem_test_abc123'
    const fetchMock = stubFetch({ byId: SUBSCRIPTION })
    const { db } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, 'sub_new', NOW)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://test-api.creem.io/v1/subscriptions?subscription_id=sub_new',
    )
  })

  it('does nothing when there is no subscription id and no owner to look up', async () => {
    const fetchMock = stubFetch({})
    const { db, statements } = fakeDb(null)

    await reconcileSubscription(db, null, NOW)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(statements).toHaveLength(0)
  })

  it('leaves the row alone when Creem knows of no matching customer', async () => {
    stubFetch({ customer: {} })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'nobody@example.com' })

    expect(writeOf(statements)).toBeUndefined()
  })

  it('leaves the row alone when the customer has no subscriptions', async () => {
    stubFetch({ customer: { id: 'cust_1' }, search: { items: [] } })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'nobody@example.com' })

    expect(writeOf(statements)).toBeUndefined()
  })
})
