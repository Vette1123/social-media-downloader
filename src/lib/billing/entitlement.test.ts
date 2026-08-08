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
   * The rule the whole cancel design rests on: an annual subscriber who cancels
   * in Creem's portal gets `canceled` immediately, with eleven months still paid
   * for. They keep those months. Creem treats that status as final; we treat the
   * money as what settles it.
   */
  it('keeps Pro when cancelled outright but the paid period is still running', () => {
    expect(isProAt(row({ sub_status: 'canceled', sub_ends_at: NOW + DAY }), NOW)).toBe(true)
  })

  it('drops Pro once an outright cancel has run past its paid period', () => {
    expect(isProAt(row({ sub_status: 'canceled', sub_ends_at: NOW - DAY }), NOW)).toBe(false)
  })

  it('drops Pro exactly at the end of the paid period, not after it', () => {
    expect(isProAt(row({ sub_status: 'canceled', sub_ends_at: NOW }), NOW)).toBe(false)
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

  // `canceled` is in this list on purpose: with no end date recorded there is no
  // paid period to honour, so it fails closed like the rest.
  it.each(['paused', 'unpaid', 'expired', 'canceled'])('is false when %s', (status) => {
    expect(isProAt(row({ sub_status: status }), NOW)).toBe(false)
  })

  it('is false for a status Creem has not documented yet', () => {
    expect(isProAt(row({ sub_status: 'something_new' }), NOW)).toBe(false)
  })
})
