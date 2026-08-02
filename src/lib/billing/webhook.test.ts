import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import {
  MAX_WEBHOOK_BYTES,
  handleWebhook,
  mayApply,
  patchFromSubscription,
  verifyWebhookSignature,
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
  const attributes = {
    status: 'active',
    variant_name: 'Monthly',
    renews_at: '2026-09-02T00:00:00.000000Z',
    ends_at: null,
    updated_at: '2026-08-02T00:00:00.000000Z',
  }

  it('maps an active subscription', () => {
    const patch = patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, null, NOW)
    expect(patch).toMatchObject({
      userId: 'u1',
      ls_subscription_id: 'sub_1',
      ls_status: 'active',
      ls_variant: 'monthly',
      ls_past_due_since: null,
    })
    expect(patch?.ls_renews_at).toBe(Date.parse(attributes.renews_at))
  })

  it('recognises the annual variant', () => {
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, variant_name: 'Annual' },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_variant).toBe('annual')
  })

  it('stamps past_due_since the first time past_due is seen', () => {
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'past_due' },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_past_due_since).toBe(NOW)
  })

  it('preserves an existing past_due_since so the grace is not extended', () => {
    const earlier = NOW - 5 * 24 * 60 * 60 * 1000
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'past_due' },
      { user_id: 'u1' },
      { ls_updated_at: null, ls_past_due_since: earlier },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBe(earlier)
  })

  it('clears past_due_since once the payment recovers', () => {
    const patch = patchFromSubscription(
      'sub_1',
      attributes,
      { user_id: 'u1' },
      { ls_updated_at: null, ls_past_due_since: NOW - 1000 },
      NOW,
    )
    expect(patch?.ls_past_due_since).toBeNull()
  })

  it('records the paid-through date on cancellation', () => {
    const endsAt = '2026-09-02T00:00:00.000000Z'
    const patch = patchFromSubscription(
      'sub_1',
      { ...attributes, status: 'cancelled', ends_at: endsAt },
      { user_id: 'u1' },
      null,
      NOW,
    )
    expect(patch?.ls_ends_at).toBe(Date.parse(endsAt))
  })

  it('drops a replayed event older than what we already stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-03T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, current, NOW)).toBeNull()
  })

  it('applies an event newer than what we stored', () => {
    const current = { ls_updated_at: Date.parse('2026-08-01T00:00:00Z'), ls_past_due_since: null }
    expect(patchFromSubscription('sub_1', attributes, { user_id: 'u1' }, current, NOW)).not.toBeNull()
  })

  it('returns null with no subscription id', () => {
    expect(patchFromSubscription(null, attributes, { user_id: 'u1' }, null, NOW)).toBeNull()
  })
})

describe('mayApply', () => {
  const live = { ls_subscription_id: 'sub_B', ls_status: 'active', ls_ends_at: null, ls_past_due_since: null }

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
    headers: { 'X-Signature': signature ?? (await sign(body, SECRET)) },
  })
}

function subscriptionEvent(
  id: string,
  attributes: Record<string, unknown>,
  meta: Record<string, unknown> = { custom_data: { user_id: 'u1' } },
): string {
  return JSON.stringify({ meta, data: { type: 'subscriptions', id, attributes } })
}

const ACTIVE = {
  status: 'active',
  variant_name: 'Annual',
  renews_at: '2027-08-02T00:00:00.000000Z',
  ends_at: null,
  user_email: 'victim@example.com',
  updated_at: '2026-08-05T00:00:00.000000Z',
}

describe('handleWebhook', () => {
  const previous = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
  })

  afterEach(() => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = previous
    vi.restoreAllMocks()
  })

  it('ignores an invoice event rather than writing the invoice id as a subscription', async () => {
    // subscription_payment_success lands seconds after subscription_created and
    // carries the invoice id, not the subscription id.
    const body = JSON.stringify({
      meta: { event_name: 'subscription_payment_success', custom_data: { user_id: 'u1' } },
      data: {
        type: 'subscription-invoices',
        id: '40771',
        attributes: { status: 'paid', updated_at: '2026-08-02T00:00:01.000000Z' },
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
    // a newer updated_at than B's, and must not touch the row.
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
      ...ACTIVE,
      status: 'expired',
      updated_at: '2026-09-01T00:00:00.000000Z',
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
      await post(subscriptionEvent('sub_B', ACTIVE)),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(200)
    const [write] = updates(statements)
    expect(write?.sql).toContain('WHERE id = ?')
    expect(write?.bindings[0]).toBe('sub_B')
    expect(write?.bindings[1]).toBe('active')
    expect(write?.bindings.at(-1)).toBe('u1')
  })

  it('refuses a buyer-supplied email that points at a row already holding a subscription', async () => {
    // The checkout URL is public and takes ?checkout[email]=, so user_email is
    // attacker input whenever custom_data is missing.
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
    const body = subscriptionEvent('sub_attacker', ACTIVE, {})

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
      await post(subscriptionEvent('sub_attacker', ACTIVE, {})),
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
    const { db } = fakeDb(rows, new Error('D1_ERROR: UNIQUE constraint failed: users.ls_subscription_id'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await handleWebhook(
      await post(subscriptionEvent('sub_B', ACTIVE)),
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
      await post(subscriptionEvent('sub_B', ACTIVE)),
      undefined,
      { DB: db },
    )

    expect(response.status).toBe(500)
  })

  it('still rejects a forged signature', async () => {
    const { db, statements } = fakeDb([])
    const body = subscriptionEvent('sub_B', ACTIVE)

    const response = await handleWebhook(await post(body, await sign(body, 'wrong')), undefined, {
      DB: db,
    })

    expect(response.status).toBe(401)
    expect(statements).toHaveLength(0)
  })
})
