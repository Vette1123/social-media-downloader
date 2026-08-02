import { describe, expect, it } from 'vitest'
import { isProAt, PAST_DUE_GRACE_MS, type BillingRow } from './entitlement'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

function row(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    ls_status: 'active',
    ls_ends_at: null,
    ls_past_due_since: null,
    ...overrides,
  }
}

describe('isProAt', () => {
  it('is false with no row at all', () => {
    expect(isProAt(null, NOW)).toBe(false)
  })

  it('is false for a user who never subscribed', () => {
    expect(isProAt(row({ ls_status: null }), NOW)).toBe(false)
  })

  it('is true while active', () => {
    expect(isProAt(row({ ls_status: 'active' }), NOW)).toBe(true)
  })

  it('is true during a trial', () => {
    expect(isProAt(row({ ls_status: 'on_trial' }), NOW)).toBe(true)
  })

  it('is true after cancelling, up to the paid-through date', () => {
    const r = row({ ls_status: 'cancelled', ls_ends_at: NOW + DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('is false once the cancelled period has elapsed', () => {
    const r = row({ ls_status: 'cancelled', ls_ends_at: NOW })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false when cancelled with no end date recorded', () => {
    expect(isProAt(row({ ls_status: 'cancelled', ls_ends_at: null }), NOW)).toBe(false)
  })

  it('keeps Pro on day 13 of the past_due grace', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - 13 * DAY })
    expect(isProAt(r, NOW)).toBe(true)
  })

  it('drops Pro exactly at the end of the past_due grace', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - PAST_DUE_GRACE_MS })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('drops Pro past the grace window', () => {
    const r = row({ ls_status: 'past_due', ls_past_due_since: NOW - 15 * DAY })
    expect(isProAt(r, NOW)).toBe(false)
  })

  it('is false for past_due with no start recorded, rather than granting forever', () => {
    expect(isProAt(row({ ls_status: 'past_due', ls_past_due_since: null }), NOW)).toBe(false)
  })

  it.each(['paused', 'unpaid', 'expired'])('is false when %s', (status) => {
    expect(isProAt(row({ ls_status: status }), NOW)).toBe(false)
  })

  it('is false for a status Lemon Squeezy has not documented yet', () => {
    expect(isProAt(row({ ls_status: 'something_new' }), NOW)).toBe(false)
  })
})
