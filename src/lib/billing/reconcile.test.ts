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
    // theirs by email; the outbound call is bounded by the cooldown, not here.
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

const LS_SUBSCRIPTION = {
  id: 'sub_new',
  type: 'subscriptions',
  attributes: {
    status: 'active',
    variant_name: 'Monthly',
    renews_at: '2026-09-02T00:00:00.000000Z',
    ends_at: null,
    updated_at: '2026-08-02T00:00:00.000000Z',
  },
}

function stubFetch(body: unknown) {
  // The parameter is declared so the recorded call is typed — vi.fn() infers an
  // empty tuple from a zero-argument implementation.
  const fetchMock = vi.fn(async (_url: string | URL | Request) =>
    new Response(JSON.stringify(body), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('reconcileSubscription', () => {
  const previous = process.env.LEMONSQUEEZY_API_KEY

  beforeEach(() => {
    process.env.LEMONSQUEEZY_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.LEMONSQUEEZY_API_KEY = previous
    vi.unstubAllGlobals()
  })

  it('looks a forced reconcile up by email when the row has no subscription id', async () => {
    const fetchMock = stubFetch({ data: [LS_SUBSCRIPTION] })
    const { db, statements } = fakeDb({
      id: 'u1',
      ls_updated_at: null,
      ls_past_due_since: null,
      ls_reconciled_at: null,
    })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.lemonsqueezy.com/v1/subscriptions?filter[user_email]=paid%40example.com',
    )

    // The subscription is adopted onto the row, keyed on the primary key.
    const write = statements.find((s) => s.sql.includes('ls_status = ?'))
    expect(write?.sql).toContain('WHERE id = ?')
    expect(write?.bindings[0]).toBe('sub_new')
    expect(write?.bindings[1]).toBe('active')
    expect(write?.bindings.at(-1)).toBe('u1')
  })

  it('stamps the cooldown before it calls Lemon Squeezy', async () => {
    stubFetch({ data: [LS_SUBSCRIPTION] })
    const { db, statements } = fakeDb({
      id: 'u1',
      ls_updated_at: null,
      ls_past_due_since: null,
      ls_reconciled_at: null,
    })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    const stamp = statements.find((s) => s.sql.includes('ls_reconciled_at = ?'))
    expect(stamp?.bindings).toEqual([NOW, 'u1'])
  })

  it('spends no Lemon Squeezy call while the cooldown is live', async () => {
    // ?reconcile=1 is a client-controlled flag: the checkout poll alone sends
    // fifteen of these in thirty seconds.
    const fetchMock = stubFetch({ data: [LS_SUBSCRIPTION] })
    const { db } = fakeDb({
      id: 'u1',
      ls_updated_at: null,
      ls_past_due_since: null,
      ls_reconciled_at: NOW - RECONCILE_COOLDOWN_MS + 1,
    })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'paid@example.com' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still refreshes an existing subscription by id', async () => {
    const fetchMock = stubFetch({ data: LS_SUBSCRIPTION })
    const { db, statements } = fakeDb({
      id: 'u1',
      ls_updated_at: null,
      ls_past_due_since: null,
      ls_reconciled_at: null,
    })

    await reconcileSubscription(db, 'sub_new', NOW)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.lemonsqueezy.com/v1/subscriptions/sub_new',
    )
    const lookup = statements[0]
    expect(lookup?.sql).toContain('WHERE ls_subscription_id = ?')
    expect(statements.find((s) => s.sql.includes('ls_status = ?'))?.bindings[1]).toBe('active')
  })

  it('does nothing when there is no subscription id and no owner to look up', async () => {
    const fetchMock = stubFetch({ data: [] })
    const { db, statements } = fakeDb(null)

    await reconcileSubscription(db, null, NOW)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(statements).toHaveLength(0)
  })

  it('leaves the row alone when Lemon Squeezy knows of no matching subscription', async () => {
    stubFetch({ data: [] })
    const { db, statements } = fakeDb({
      id: 'u1',
      ls_updated_at: null,
      ls_past_due_since: null,
      ls_reconciled_at: null,
    })

    await reconcileSubscription(db, null, NOW, { id: 'u1', email: 'nobody@example.com' })

    expect(statements.find((s) => s.sql.includes('ls_status = ?'))).toBeUndefined()
  })
})
