import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import {
  RECONCILE_COOLDOWN_MS,
  RECONCILE_STALE_MS,
  needsReconcile,
  reconcileSubscription,
  CHECKOUT_LOOKBACK_MS,
} from './reconcile'

const NOW = 1_800_000_000_000

describe('needsReconcile', () => {
  it('is false for a user who never subscribed', () => {
    expect(needsReconcile({ sub_id: null, sub_updated_at: null }, NOW, false)).toBe(false)
  })

  it('is false for a freshly updated row', () => {
    const row = { sub_id: 'sub_1', sub_updated_at: NOW - 1000 }
    expect(needsReconcile(row, NOW, false)).toBe(false)
  })

  it('is true once the row is stale', () => {
    const row = { sub_id: 'sub_1', sub_updated_at: NOW - RECONCILE_STALE_MS - 1 }
    expect(needsReconcile(row, NOW, false)).toBe(true)
  })

  it('is true for a subscription that has never been stamped', () => {
    expect(needsReconcile({ sub_id: 'sub_1', sub_updated_at: null }, NOW, false)).toBe(true)
  })

  it('is true when forced, even on a fresh row', () => {
    const row = { sub_id: 'sub_1', sub_updated_at: NOW }
    expect(needsReconcile(row, NOW, true)).toBe(true)
  })

  /**
   * The lost-first-webhook buyer, unforced. Before the checkout stamp existed
   * this returned false forever: no sub_id meant "nothing to repair", so
   * someone who paid and closed the tab stayed on the free plan permanently.
   */
  it('is true for a user who opened a checkout and has no subscription yet', () => {
    const row = { sub_id: null, sub_updated_at: null, sub_checkout_at: NOW - 60_000 }
    expect(needsReconcile(row, NOW, false)).toBe(true)
  })

  it('stops searching once the checkout attempt is old enough to be abandoned', () => {
    const row = { sub_id: null, sub_updated_at: null, sub_checkout_at: NOW - CHECKOUT_LOOKBACK_MS - 1 }
    expect(needsReconcile(row, NOW, false)).toBe(false)
  })

  it('does not search a free user who never opened a checkout', () => {
    expect(needsReconcile({ sub_id: null, sub_updated_at: null, sub_checkout_at: null }, NOW, false)).toBe(
      false,
    )
  })

  it('is true when forced with no subscription id — that is the case it exists for', () => {
    // Only a webhook writes sub_id, so the user whose first webhook
    // was lost is exactly the user with none. `reconcileSubscription` finds
    // theirs by searching; the outbound call is bounded by the cooldown, not here.
    expect(needsReconcile({ sub_id: null, sub_updated_at: null }, NOW, true)).toBe(true)
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
  metadata: { user_id: 'u1' },
  next_transaction_date: '2026-09-02T00:00:00.000Z',
  current_period_end_date: null,
  updated_at: '2026-08-02T00:00:00.000Z',
}

/** Someone else's subscription, which the walk must step over. */
const OTHER_SUBSCRIPTION = {
  ...SUBSCRIPTION,
  id: 'sub_someone_else',
  customer: { id: 'cust_9', email: 'other@example.com' },
  metadata: { user_id: 'u9' },
}

const page = (items: unknown[], nextPage: number | null = null) => ({
  items,
  pagination: { next_page: nextPage },
})

const PENDING_ROW = {
  id: 'u1',
  sub_customer_id: null,
  sub_updated_at: null,
  sub_past_due_since: null,
  sub_reconciled_at: null,
}

/**
 * Answers by path. `search` may be a single page or one page per call, since
 * the repair walks the store a page at a time.
 */
function stubFetch(routes: { search?: unknown | unknown[]; byId?: unknown }) {
  let searchCalls = 0
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    const pick = () => {
      if (!href.includes('/subscriptions/search')) return routes.byId
      const pages = routes.search
      if (!Array.isArray(pages)) return pages
      return pages[searchCalls++]
    }
    return new Response(JSON.stringify(pick() ?? null), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const writeOf = (statements: { sql: string; bindings: unknown[] }[]) =>
  statements.find((s) => s.sql.includes('sub_status = ?'))

/**
 * A repair means a webhook did not arrive. Creem gives up retrying after about
 * an hour, so past that point this is the only thing keeping the row right —
 * and the outage that started all of this was invisible precisely because
 * nothing said so. The warning is the alarm, so it is tested like one.
 */
describe('repair reporting', () => {
  const previous = process.env.CREEM_API_KEY

  beforeEach(() => {
    process.env.CREEM_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    process.env.CREEM_API_KEY = previous
  })

  it('warns when it had to change a status a webhook should have written', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { db } = fakeDb({ ...PENDING_ROW, sub_id: 'sub_new', sub_status: 'past_due' })
    stubFetch({ byId: SUBSCRIPTION })

    await reconcileSubscription(db, 'sub_new', Date.parse('2026-08-03T00:00:00.000Z'), {
      id: 'u1',
      email: 'paid@example.com',
    })

    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain('past_due')
    expect(String(warn.mock.calls[0][0])).toContain('active')
  })

  it('stays quiet when the row already agreed with Creem', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { db } = fakeDb({ ...PENDING_ROW, sub_id: 'sub_new', sub_status: 'active' })
    stubFetch({ byId: SUBSCRIPTION })

    await reconcileSubscription(db, 'sub_new', Date.parse('2026-08-03T00:00:00.000Z'), {
      id: 'u1',
      email: 'paid@example.com',
    })

    expect(warn).not.toHaveBeenCalled()
  })
})

describe('reconcileSubscription', () => {
  const previous = process.env.CREEM_API_KEY

  beforeEach(() => {
    process.env.CREEM_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.CREEM_API_KEY = previous
    vi.unstubAllGlobals()
  })

  /**
   * The search endpoint accepts no filter at all — it 400s on `customer_id`,
   * on `email`, on anything but paging — so the match happens here, against
   * the `metadata.user_id` the checkout link put on the subscription.
   */
  it('finds a forced reconcile by walking the store when the row has no subscription id', async () => {
    const fetchMock = stubFetch({ search: page([SUBSCRIPTION]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.creem.io/v1/subscriptions/search?page_number=1&page_size=100',
    )

    // The subscription is adopted onto the row, keyed on the primary key.
    const write = writeOf(statements)
    expect(write?.sql).toContain('WHERE id = ?')
    expect(write?.bindings[0]).toBe('sub_new')
    expect(write?.bindings[1]).toBe('cust_1')
    expect(write?.bindings[2]).toBe('active')
    expect(write?.bindings.at(-1)).toBe('u1')
  })

  it('steps over other people’s subscriptions on the way', async () => {
    stubFetch({ search: page([OTHER_SUBSCRIPTION, SUBSCRIPTION]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(writeOf(statements)?.bindings[0]).toBe('sub_new')
  })

  it('follows next_page until it finds the owner', async () => {
    const fetchMock = stubFetch({
      search: [page([OTHER_SUBSCRIPTION], 2), page([SUBSCRIPTION])],
    })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('page_number=2')
    expect(writeOf(statements)?.bindings[0]).toBe('sub_new')
  })

  it('stops at the last page rather than paging forever', async () => {
    const fetchMock = stubFetch({ search: page([OTHER_SUBSCRIPTION]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(writeOf(statements)).toBeUndefined()
  })

  /** A purchase that arrived without our metadata still has to be findable. */
  it('falls back to the address, case-insensitively', async () => {
    const noMetadata = { ...SUBSCRIPTION, metadata: null }
    stubFetch({ search: page([noMetadata]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'PAID@Example.com' })

    expect(writeOf(statements)?.bindings[0]).toBe('sub_new')
  })

  it('matches on a stored customer id when there is neither metadata nor a match on email', async () => {
    const noMetadata = { ...SUBSCRIPTION, metadata: null }
    stubFetch({ search: page([noMetadata]) })
    const { db, statements } = fakeDb({ ...PENDING_ROW, sub_customer_id: 'cust_1' })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'changed@example.com' })

    expect(writeOf(statements)?.bindings[0]).toBe('sub_new')
  })

  it('stamps the cooldown before it calls Creem', async () => {
    stubFetch({ search: page([SUBSCRIPTION]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    const stamp = statements.find((s) => s.sql.includes('sub_reconciled_at = ?'))
    expect(stamp?.bindings).toEqual([NOW, 'u1'])
  })

  it('spends no Creem call while the cooldown is live', async () => {
    // ?reconcile=1 is a client-controlled flag: the checkout poll alone sends
    // fifteen of these in thirty seconds.
    const fetchMock = stubFetch({ search: page([SUBSCRIPTION]) })
    const { db } = fakeDb({ ...PENDING_ROW, sub_reconciled_at: NOW - RECONCILE_COOLDOWN_MS + 1 })

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
    expect(lookup?.sql).toContain('WHERE sub_id = ?')
    expect(writeOf(statements)?.bindings[2]).toBe('active')
  })

  /**
   * The unrepairable state this repair used to leave behind.
   *
   * A customer cancels, resubscribes, and the new subscription's webhook is
   * lost. The row still holds the cancelled id, so asking Creem by that id
   * returns the cancelled subscription, the patch agrees with the row, and
   * nothing is written — on every attempt, forever. The live subscription has to
   * be found by searching, exactly as it is for a row with no id at all.
   */
  it('adopts a live subscription when the stored one has stopped', async () => {
    const dead = { ...SUBSCRIPTION, id: 'sub_dead', status: 'canceled' }
    const live = { ...SUBSCRIPTION, id: 'sub_fresh', status: 'active' }
    stubFetch({ byId: dead, search: page([dead, live]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, 'sub_dead', NOW, { id: 'u1', email: 'paid@example.com' })

    const write = writeOf(statements)
    expect(write?.bindings[0]).toBe('sub_fresh')
    expect(write?.bindings[2]).toBe('active')
  })

  it('keeps the stored subscription when the search turns up nothing live', async () => {
    const dead = { ...SUBSCRIPTION, id: 'sub_dead', status: 'canceled' }
    stubFetch({ byId: dead, search: page([dead]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, 'sub_dead', NOW, { id: 'u1', email: 'paid@example.com' })

    const write = writeOf(statements)
    expect(write?.bindings[0]).toBe('sub_dead')
    expect(write?.bindings[2]).toBe('canceled')
  })

  /** No search at all while the stored subscription is one Creem still bills. */
  it('does not spend a search on a healthy subscriber', async () => {
    const fetchMock = stubFetch({ byId: SUBSCRIPTION, search: page([SUBSCRIPTION]) })
    const { db } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, 'sub_new', NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('subscription_id=sub_new')
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

  it('leaves the row alone when the store holds nothing for this user', async () => {
    stubFetch({ search: page([]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'nobody@example.com' })

    expect(writeOf(statements)).toBeUndefined()
  })

  it('leaves the row alone when the store is empty', async () => {
    stubFetch({ search: page([]) })
    const { db, statements } = fakeDb(PENDING_ROW)

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'nobody@example.com' })

    expect(writeOf(statements)).toBeUndefined()
  })
})
