import { describe, expect, it } from 'vitest'
import {
  hasGrant,
  isEntitled,
  isProAt,
  PAST_DUE_GRACE_MS,
  type BillingRow,
} from './entitlement'

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

/**
 * Grants are the whole entitlement system now, and one of the two is a
 * credential switch. Both halves of that matter here: `pro` must be easy to
 * hand out, and `ig` must be impossible to arrive at by accident.
 */
describe('hasGrant', () => {
  it('is false for a row with no grants column set', () => {
    expect(hasGrant(row(), 'pro')).toBe(false)
    expect(hasGrant(null, 'pro')).toBe(false)
    expect(hasGrant(row({ grants: '' }), 'pro')).toBe(false)
  })

  it('finds a single grant', () => {
    expect(hasGrant(row({ grants: 'pro' }), 'pro')).toBe(true)
  })

  it('finds a grant anywhere in the list, with or without spaces', () => {
    expect(hasGrant(row({ grants: 'ig,pro' }), 'pro')).toBe(true)
    expect(hasGrant(row({ grants: 'pro, ig' }), 'ig')).toBe(true)
    expect(hasGrant(row({ grants: ' pro , ig ' }), 'ig')).toBe(true)
  })

  it('does not confuse one grant for another', () => {
    expect(hasGrant(row({ grants: 'pro' }), 'ig')).toBe(false)
    expect(hasGrant(row({ grants: 'ig' }), 'pro')).toBe(false)
  })

  /**
   * The bug a substring check would have shipped. `'igloo'.includes('ig')` is
   * true, and the grant this protects attaches our own Instagram session to a
   * request — so a future grant name that merely contains these letters must
   * not switch it on.
   */
  it('matches whole names only, never a substring', () => {
    expect(hasGrant(row({ grants: 'igloo' }), 'ig')).toBe(false)
    expect(hasGrant(row({ grants: 'prospect' }), 'pro')).toBe(false)
    expect(hasGrant(row({ grants: 'no-pro' }), 'pro')).toBe(false)
  })
})

describe('isEntitled', () => {
  it('is true from a grant with no subscription at all', () => {
    expect(isEntitled(row({ sub_status: null, grants: 'pro' }), NOW)).toBe(true)
  })

  it('is true from a subscription with no grant', () => {
    expect(isEntitled(row({ sub_status: 'active' }), NOW)).toBe(true)
  })

  it('is false with neither', () => {
    expect(isEntitled(row({ sub_status: null }), NOW)).toBe(false)
    expect(isEntitled(null, NOW)).toBe(false)
  })

  /**
   * The separation that makes the credential grant safe. `ig` is not a feature
   * entitlement and must never imply one, so that "give this account the
   * extras" and "attach our Instagram session" can never be the same act.
   */
  it('is not granted by the credential flag', () => {
    expect(isEntitled(row({ sub_status: null, grants: 'ig' }), NOW)).toBe(false)
  })

  /**
   * And the converse, which is the one that would cost real money: a supporter
   * gets Pro's features and must not get the session with them.
   */
  it('does not hand the credential flag to a supporter', () => {
    const supporter = row({ sub_status: null, grants: 'pro' })
    expect(isEntitled(supporter, NOW)).toBe(true)
    expect(hasGrant(supporter, 'ig')).toBe(false)
  })

  it('leaves a lapsed subscription lapsed unless a grant says otherwise', () => {
    expect(isEntitled(row({ sub_status: 'expired' }), NOW)).toBe(false)
    expect(isEntitled(row({ sub_status: 'expired', grants: 'pro' }), NOW)).toBe(true)
  })
})
