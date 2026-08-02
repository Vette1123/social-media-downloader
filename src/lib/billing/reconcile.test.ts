import { describe, expect, it } from 'vitest'
import { RECONCILE_STALE_MS, needsReconcile } from './reconcile'

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

  it('stays false when forced if there is no subscription to reconcile', () => {
    expect(needsReconcile({ ls_subscription_id: null, ls_updated_at: null }, NOW, true)).toBe(false)
  })
})
