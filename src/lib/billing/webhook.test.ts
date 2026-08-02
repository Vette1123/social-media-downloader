import { describe, expect, it } from 'vitest'
import { patchFromSubscription, verifyWebhookSignature } from './webhook'

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
