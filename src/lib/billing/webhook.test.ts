import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import {
  MAX_WEBHOOK_BYTES,
  SIGNATURE_HEADER,
  handleWebhook,
  mayApply,
  patchFromSubscription,
  verifyWebhookSignature,
  type CreemSubscription,
} from './webhook'

const SECRET = 'test-signing-secret'
const NOW = 1_800_000_000_000

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed body', async () => {
    const body = '{"ok":true}'
    expect(await verifyWebhookSignature(body, await sign(body, SECRET), SECRET)).toBe(true)
  })

  it('rejects a tampered body', async () => {
    const signature = await sign('{"ok":true}', SECRET)
    expect(await verifyWebhookSignature('{"ok":false}', signature, SECRET)).toBe(false)
  })

  it('rejects a signature made with a different secret', async () => {
    const body = '{"ok":true}'
    expect(await verifyWebhookSignature(body, await sign(body, 'wrong'), SECRET)).toBe(false)
  })

  it('rejects a missing signature', async () => {
    expect(await verifyWebhookSignature('{}', null, SECRET)).toBe(false)
  })

  it('rejects a non-hex signature rather than throwing', async () => {
    expect(await verifyWebhookSignature('{}', 'not-hex!!', SECRET)).toBe(false)
  })
})

describe('patchFromSubscription', () => {
  const subscription: CreemSubscription = {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    product: { id: 'prod_m', name: 'Pro Monthly' },
    customer: { id: 'cust_1', email: 'buyer@example.com' },
    metadata: { user_id: 'u1' },
    next_transaction_date: '2026-09-02T00:00:00.000Z',
    current_period_end_date: null,
    updated_at: '2026-08-02T00:00:00.000Z',
  }

  it('maps an active subscription', () => {
    const patch = patchFromSubscription(subscription, null, NOW)
    expect(patch).toMatchObject({
      userId: 'u1',
      ls_subscription_id: 'sub_1',
      ls_customer_id: 'cust_1',
      ls_status: 'active',
      ls_variant: 'monthly',
      ls_past_due_since: null,
    })
    expect(patch?.ls_renews_at).toBe(Date.parse('2026-09-02T00:00:00.000Z'))
  })

  it('recognises the annual variant from the product name', () => {
    const patch = patchFromSubscription(
      { ...subscription, product: { id: 'prod_a', name: 'Pro Annual' } },
      null,
      NOW,
    )
    expect(patch?.ls_variant).toBe('annual')
  })

  /**
   * Creem sends a bare id string wherever an object is not expanded. Reading
   * `.email` off a string yields undefined rather than throwing, so the risk is
   * a silently wrong row, not a crash — which is why it is asserted.
   */
  it('survives an unexpanded customer and product', () => {
    const patch = patchFromSubscription(
      { ...subscription, customer: 'cust_1', product: 'prod_a' },
      null,
      NOW,
    )
    expect(patch).toMatchObject({ ls_customer_id: null, email: null, ls_variant: 'monthly' })
  })

  it('stamps past_due_since the first time past_due is seen', () => {
    const patch = patchFromSubscription({ ...subscription, status: 'past_due' }, null, NOW)
    expect(patch?.ls_past_due_since).toBe(NOW)
  })

  it('preserves an existing past_due_since so the grace is not extended', () => {
    const earlier = NOW - 5 * 24 * 60 * 60 * 1000
    const patch = patchFromSubscription(
      { ...subscription, status: 'past_due' },
      { ls_updated_at: null, ls_past_due_since: earlier },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBe(earlier)
  })

  it('clears past_due_since once the payment recovers', () => {
    const patch = patchFromSubscription(
      subscription,
      { ls_updated_at: null, ls_past_due_since: NOW - 1000 },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBeNull()
  })

  it('records the paid-through date on a scheduled cancellation', () => {
    const endsAt = '2026-09-02T00:00:00.000Z'
    const patch = patchFromSubscription(
      {
        ...subscription,
        status: 'scheduled_cancel',
        next_transaction_date: null,
        current_period_end_date: endsAt,
      },
      null,
      NOW,
    )
    expect(patch?.ls_ends_at).toBe(Date.parse(endsAt))
    // No further charge is scheduled, so the date the account page shows is
    // the date it lapses.
    expect(patch?.ls_renews_at).toBe(Date.parse(endsAt))
  })

  it('drops a replayed event older than what we already stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-03T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription(subscription, current, NOW)).toBeNull()
  })

  it('applies an event newer than what we stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-01T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription(subscription, current, NOW)).not.toBeNull()
  })

  /**
   * Without some monotonic stamp the replay guard has nothing to compare and
   * every redelivery reapplies, so the event's own epoch-millis `created_at`
   * stands in when the subscription carries no `updated_at`.
   */
  it('falls back to the event timestamp when the subscription has no updated_at', () => {
    const observed = Date.parse('2026-08-04T00:00:00Z')
    const current = { ls_updated_at: Date.parse('2026-08-03T00:00:00Z'), ls_past_due_since: null }
    const stale = { ...subscription, updated_at: null }

    expect(patchFromSubscription(stale, current, NOW, observed)?.ls_updated_at).toBe(observed)
    expect(patchFromSubscription(stale, current, NOW, observed - 2 * 86_400_000)).toBeNull()
  })

  it('returns null with no subscription id', () => {
    expect(patchFromSubscription({ ...subscription, id: undefined }, null, NOW)).toBeNull()
  })

  it('returns null with no status', () => {
    expect(patchFromSubscription({ ...subscription, status: undefined }, null, NOW)).toBeNull()
  })
})

describe('mayApply', () => {
  const live = {
    ls_subscription_id: 'sub_B',
    ls_status: 'active',
    ls_ends_at: null,
    ls_past_due_since: null,
  }

  it('allows a row that holds no subscription yet', () => {
    expect(mayApply({ ...live, ls_subscription_id: null }, 'sub_A', 'email', NOW)).toBe(true)
  })

  it('allows an event for the subscription the row already holds', () => {
    expect(mayApply(live, 'sub_B', 'email', NOW)).toBe(true)
  })

  it('never lets a buyer-supplied email rebind a row that holds a subscription', () => {
    expect(mayApply({ ...live, ls_status: 'expired' }, 'sub_A', 'email', NOW)).toBe(false)
  })

  it('refuses a trusted event for a superseded subscription while the held one is live', () => {
    expect(mayApply(live, 'sub_A', 'user_id', NOW)).toBe(false)
  })

  it('allows a trusted switch once the held subscription is dead', () => {
    expect(mayApply({ ...live, ls_status: 'expired' }, 'sub_A', 'user_id', NOW)).toBe(true)
  })
})

/**
 * Records every statement the handler prepares and serves the same canned rows
 * to `first` and `all`, so the tests can assert on what it wrote — or did not
 * write — without standing up a real D1. Same shape as auth/session.test.ts.
 */
function fakeDb(rows: Record<string, unknown>[], runError?: unknown) {
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
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
        run: async () => {
          if (runError) throw runError
          return {}
        },
      }
      return stmt
    },
  }
  return { db: db as unknown as D1Database, statements }
}

const updates = (statements: { sql: string; bindings: unknown[] }[]) =>
  statements.filter((s) => s.sql.trimStart().startsWith('UPDATE users'))

async function post(body: string, signature?: string): Promise<Request> {
  return new Request('https://example.com/api/billing/webhook', {
    method: 'POST',
    body,
    headers: { [SIGNATURE_HEADER]: signature ?? (await sign(body, SECRET)) },
  })
}

const ACTIVE = {
  object: 'subscription',
  status: 'active',
  product: { id: 'prod_a', name: 'Pro Annual' },
  customer: { id: 'cust_1', email: 'victim@example.com' },
  current_period_end_date: null,
  next_transaction_date: '2027-08-02T00:00:00.000Z',
  updated_at: '2026-08-05T00:00:00.000Z',
}

function subscriptionEvent(
  id: string,
  overrides: Record<string, unknown> = {},
  metadata: Record<string, unknown> | null = { user_id: 'u1' },
): string {
  return JSON.stringify({
    eventType: 'subscription.active',
    created_at: Date.parse('2026-08-05T00:00:00Z'),
    object: { id, ...ACTIVE, ...overrides, metadata },
  })
}

describe('handleWebhook', () => {
  const previous = process.env.CREEM_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.CREEM_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    process.env.CREEM_WEBHOOK_SECRET = previous
    vi.restoreAllMocks()
  })

  it('ignores a checkout event rather than writing the checkout id as a subscription', async () => {
    // checkout.completed lands seconds before subscription.active and carries a
    // checkout id, not a subscription id.
    const body = JSON.stringify({
      eventType: 'checkout.completed',
      created_at: Date.parse('2026-08-05T00:00:01Z'),
      object: {
        id: 'ch_40771',
        object: 'checkout',
        status: 'completed',
        metadata: { user_id: 'u1' },
      },
    })
    const { db, statements } = fakeDb([{ id: 'u1', ls_subscription_id: 'sub_A' }])

    const response = await handleWebhook(await post(body), undefined, { DB: db })

    expect(response.status).toBe(200)
    expect(updates(statements)).toHaveLength(0)
    // Not even a lookup: the event is discarded before the user is resolved.
    expect(statements).toHaveLength(0)
  })

  it('does not let an expiry for a superseded subscription clobber a live one', async () => {
    // Cancelled monthly A, then bought annual B. A's expiry fires on 1 Sep with
    // a newer timestamp than B's, and must not touch the row.
    const { db, statements } = fakeDb([
      {
        id: 'u1',
        ls_subscription_id: 'sub_B',
        ls_status: 'active',
        ls_ends_at: null,
        ls_past_due_since: null,
        ls_updated_at: Date.parse('2026-08-05T00:00:00Z'),
      },
    ])
    const body = subscriptionEvent('sub_A', {
      status: 'expired',
      updated_at: '2026-09-01T00:00:00.000Z',
    })

    const response = await handleWebhook(await post(body), undefined, { DB: db })

    expect(response.status).toBe(200)
    expect(updates(statements)).toHaveLength(0)
  })

  it('applies a legitimate switch away from a subscription that is already dead', async () => {
    const { db, statements } = fakeDb([
      {
        id: 'u1',
        ls_subscription_id: 'sub_A',
        ls_status: 'expired',
        ls_ends_at: null,
        ls_past_due_since: null,
        ls_updated_at: Date.parse('2026-08-01T00:00:00Z'),
      },
    ])

    const response = await handleWebhook(
      await post(subscriptionEvent('sub_B')),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(200)
    const [write] = updates(statements)
    expect(write?.sql).toContain('WHERE id = ?')
    expect(write?.bindings[0]).toBe('sub_B')
    expect(write?.bindings[1]).toBe('cust_1')
    expect(write?.bindings[2]).toBe('active')
    expect(write?.bindings.at(-1)).toBe('u1')
  })

  it('refuses a buyer-supplied email that points at a row already holding a subscription', async () => {
    // The checkout URL is public, so the address on a purchase is attacker
    // input whenever metadata.user_id is missing.
    const { db, statements } = fakeDb([
      {
        id: 'victim',
        ls_subscription_id: 'sub_victim',
        ls_status: 'expired',
        ls_ends_at: null,
        ls_past_due_since: null,
        ls_updated_at: null,
      },
    ])
    const body = subscriptionEvent('sub_attacker', {}, null)

    const response = await handleWebhook(await post(body), undefined, { DB: db })

    expect(response.status).toBe(200)
    expect(updates(statements)).toHaveLength(0)
  })

  it('binds by email only when that email identifies exactly one account', async () => {
    const row = {
      id: 'victim',
      ls_subscription_id: null,
      ls_status: null,
      ls_ends_at: null,
      ls_past_due_since: null,
      ls_updated_at: null,
    }
    const { db, statements } = fakeDb([row, { ...row, id: 'victim-2' }])

    const response = await handleWebhook(
      await post(subscriptionEvent('sub_attacker', {}, null)),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(200)
    expect(updates(statements)).toHaveLength(0)
  })

  it('rejects an oversized body before spending CPU on the HMAC', async () => {
    const { db, statements } = fakeDb([])
    // Deliberately unsigned: a 413 rather than a 401 proves the body never
    // reached the verify.
    const body = 'x'.repeat(MAX_WEBHOOK_BYTES + 1)

    const response = await handleWebhook(await post(body, '00'), undefined, { DB: db })

    expect(response.status).toBe(413)
    expect(statements).toHaveLength(0)
  })

  it('drains the retry queue when the subscription is already bound elsewhere', async () => {
    const rows = [
      {
        id: 'u1',
        ls_subscription_id: null,
        ls_status: null,
        ls_ends_at: null,
        ls_past_due_since: null,
        ls_updated_at: null,
      },
    ]
    const { db } = fakeDb(
      rows,
      new Error('D1_ERROR: UNIQUE constraint failed: users.ls_subscription_id'),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await handleWebhook(
      await post(subscriptionEvent('sub_B')),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(200)
  })

  it('asks for a retry when the write fails for a reason a retry could fix', async () => {
    const rows = [
      {
        id: 'u1',
        ls_subscription_id: null,
        ls_status: null,
        ls_ends_at: null,
        ls_past_due_since: null,
        ls_updated_at: null,
      },
    ]
    const { db } = fakeDb(rows, new Error('D1_ERROR: network'))

    const response = await handleWebhook(
      await post(subscriptionEvent('sub_B')),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(500)
  })

  it('still rejects a forged signature', async () => {
    const { db, statements } = fakeDb([])
    const body = subscriptionEvent('sub_B')

    const response = await handleWebhook(await post(body, await sign(body, 'wrong')), undefined, {
      DB: db,
    })

    expect(response.status).toBe(401)
    expect(statements).toHaveLength(0)
  })
})
