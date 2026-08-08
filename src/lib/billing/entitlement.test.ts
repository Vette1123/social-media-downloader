import { describe, expect, it } from 'vitest'
import { isProAt, PAST_DUE_GRACE_MS, type BillingRow } from './entitlement'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

function row(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    sub_status: 'active',
    sub_ends_at: null,
    sub_past_due_since: null,
    ...overrides,
  }
}

describe('isProAt', () => {
  it('is false with no row at all', () => {
    expect(isProAt(null, NOW)).toBe(false)
  })

  it('is false for a user who never subscribed', () => {
    expect(isProAt(row({ sub_status: null }), NOW)).toBe(false)
  })

  it('is true while active', () => {
    expect(isProAt(row({ sub_status: 'active' }), NOW)).toBe(true)
  })

  it('is true during a trial', () => {
    expect(isProAt(row({ sub_status: 'trialing' }), NOW)).toBe(true)
  })

  it('is true after cancelling, up to the paid-through date', () => {
    const r = row({ sub_status: 'scheduled_cancel', sub_ends_at: NOW + DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('is false once the cancelled period has elapsed', () => {
    const r = row({ sub_status: 'scheduled_cancel', sub_ends_at: NOW })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false when cancelled with no end date recorded', () => {
    expect(isProAt(row({ sub_status: 'scheduled_cancel', sub_ends_at: null }), NOW)).toBe(false)
  })

  /**
   * A stopped subscription must not be rescued by an end date that has not
   * passed yet. `scheduled_cancel` is still running; `canceled` has already
   * stopped, and only the first one is allowed to consult `sub_ends_at`.
   */
  it('is false when already cancelled, even with a future end date', () => {
    expect(isProAt(row({ sub_status: 'canceled', sub_ends_at: NOW + DAY }), NOW)).toBe(false)
  })

  it('keeps Pro on day 13 of the past_due grace', () => {
    const r = row({ sub_status: 'past_due', sub_past_due_since: NOW - 13 * DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('drops Pro exactly at the end of the past_due grace', () => {
    const r = row({ sub_status: 'past_due', sub_past_due_since: NOW - PAST_DUE_GRACE_MS })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('drops Pro past the grace window', () => {
    const r = row({ sub_status: 'past_due', sub_past_due_since: NOW - 15 * DAY })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false for past_due with no start recorded, rather than granting forever', () => {
    expect(isProAt(row({ sub_status: 'past_due', sub_past_due_since: null }), NOW)).toBe(false)
  })

  it.each(['paused', 'unpaid', 'expired', 'canceled'])('is false when %s', (status) => {
    expect(isProAt(row({ sub_status: status }), NOW)).toBe(false)
  })

  it('is false for a status Creem has not documented yet', () => {
    expect(isProAt(row({ sub_status: 'something_new' }), NOW)).toBe(false)
  })
})
