import { describe, expect, it } from 'vitest'
import { classifyPlan, planCopy } from './AccountPanel'
import { isProAt } from '@/lib/billing/entitlement'

/**
 * The plan card is the only screen that tells someone what they are paying for
 * and until when, so each of its six states is pinned here rather than checked
 * by eye. The state that matters most is `canceled` with time left: Creem's
 * portal writes that status the instant someone clicks its Cancel, and reading
 * it as "ended" is what used to take eleven paid months off an annual plan.
 */

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

const plan = (over: Partial<Parameters<typeof classifyPlan>[0] & object> = {}) => ({
  status: 'active',
  variant: 'annual',
  renewsAt: NOW + 30 * DAY,
  endsAt: null,
  pastDueSince: null,
  ...over,
})

describe('classifyPlan', () => {
  it('is free with no plan at all', () => {
    expect(classifyPlan(null, NOW)).toBe('free')
  })

  it('separates the two live variants, since they price differently', () => {
    expect(classifyPlan(plan({ variant: 'annual' }), NOW)).toBe('active-annual')
    expect(classifyPlan(plan({ variant: 'monthly' }), NOW)).toBe('active-monthly')
  })

  it('treats a trial as live, on whichever variant it is trialling', () => {
    expect(classifyPlan(plan({ status: 'trialing', variant: 'annual' }), NOW)).toBe('active-annual')
    expect(classifyPlan(plan({ status: 'trialing', variant: 'monthly' }), NOW)).toBe(
      'active-monthly',
    )
  })

  it('shows a scheduled cancel as still-running', () => {
    expect(classifyPlan(plan({ status: 'scheduled_cancel', endsAt: NOW + DAY }), NOW)).toBe(
      'cancelled',
    )
  })

  /** The portal-cancel case. Cancelled outright, months still paid for. */
  it('shows an outright cancel as still-running while the paid period lasts', () => {
    expect(classifyPlan(plan({ status: 'canceled', endsAt: NOW + 300 * DAY }), NOW)).toBe(
      'cancelled',
    )
  })

  it('shows an outright cancel as ended once the paid period is gone', () => {
    expect(classifyPlan(plan({ status: 'canceled', endsAt: NOW - DAY }), NOW)).toBe('ended')
    expect(classifyPlan(plan({ status: 'canceled', endsAt: null }), NOW)).toBe('ended')
  })

  it('surfaces a failed payment as its own state', () => {
    expect(classifyPlan(plan({ status: 'past_due', pastDueSince: NOW }), NOW)).toBe('past-due')
  })

  it.each(['expired', 'unpaid', 'paused'])('shows %s as ended', (status) => {
    expect(classifyPlan(plan({ status }), NOW)).toBe('ended')
  })

  it('falls back to free for a status Creem has not invented yet', () => {
    expect(classifyPlan(plan({ status: 'something_new' }), NOW)).toBe('free')
  })

  /**
   * The card and the entitlement must never disagree: a screen saying "Pro
   * until August" while the server refuses Pro features is a support ticket, and
   * the reverse is giving away the product. Both read `paidThrough`, and this is
   * what holds them together.
   */
  it('never claims Pro on screen when the server would refuse it', () => {
    const cases = [
      plan({ status: 'active' }),
      plan({ status: 'trialing' }),
      plan({ status: 'canceled', endsAt: NOW + DAY }),
      plan({ status: 'canceled', endsAt: NOW - DAY }),
      plan({ status: 'scheduled_cancel', endsAt: NOW + DAY }),
      plan({ status: 'scheduled_cancel', endsAt: NOW - DAY }),
      plan({ status: 'past_due', pastDueSince: NOW }),
      plan({ status: 'expired' }),
      plan({ status: 'unpaid' }),
      plan({ status: 'paused' }),
    ]

    for (const p of cases) {
      const looksPro = ['active-monthly', 'active-annual', 'cancelled', 'past-due'].includes(
        classifyPlan(p, NOW),
      )
      const isPro = isProAt(
        { sub_status: p.status, sub_ends_at: p.endsAt, sub_past_due_since: p.pastDueSince },
        NOW,
      )
      expect(looksPro, `${p.status} endsAt=${p.endsAt}`).toBe(isPro)
    }
  })
})

describe('planCopy', () => {
  it('names the date a cancelled plan actually runs to', () => {
    const copy = planCopy('cancelled', plan({ status: 'canceled', endsAt: NOW + DAY }))
    expect(copy.lede).toContain('Pro until')
    expect(copy.lede).toContain("Won't renew")
  })

  it('does not tell someone their subscription ended while they still have it', () => {
    const copy = planCopy('cancelled', plan({ status: 'canceled', endsAt: NOW + DAY }))
    expect(copy.lede).not.toContain('ended')
  })

  it('explains an ended plan rather than stating it', () => {
    expect(planCopy('ended', null).lede).toContain('free plan')
  })

  it('survives a cancelled plan with no end date recorded', () => {
    expect(planCopy('cancelled', plan({ status: 'canceled', endsAt: null })).lede).toContain(
      'end of the period',
    )
  })

  it('tells a past-due subscriber when Pro actually stops', () => {
    const copy = planCopy('past-due', plan({ status: 'past_due', pastDueSince: NOW }))
    expect(copy.lede).toContain('Pro stays on until')
  })
})

/**
 * The card's at-a-glance layer. The chip and the fact rows are a second way to
 * read the same six states, so the thing worth pinning is that they cannot
 * contradict the sentence next to them — a card reading "Active" over "Won't
 * renew" is worse than either alone.
 */
describe('the plan card at a glance', () => {
  const BUCKETS = [
    'free',
    'active-monthly',
    'active-annual',
    'cancelled',
    'past-due',
    'ended',
  ] as const

  it('gives every state a heading and a badge', () => {
    for (const bucket of BUCKETS) {
      const copy = planCopy(bucket, plan())
      expect(copy.title, bucket).toBeTruthy()
      expect(copy.chip.label, bucket).toBeTruthy()
    }
  })

  it('spends the warning colour only on the state that needs paying attention', () => {
    const warned = BUCKETS.filter((b) => planCopy(b, plan()).chip.tone === 'warn')
    expect(warned).toEqual(['past-due'])
  })

  it('prices only the states that are actually charging', () => {
    const priced = BUCKETS.filter((b) => planCopy(b, plan()).price !== undefined)
    expect(priced).toEqual(['active-monthly', 'active-annual'])
  })

  it('never shows a next charge to someone who has cancelled', () => {
    const copy = planCopy('cancelled', plan({ status: 'canceled', endsAt: NOW + DAY }))
    expect(copy.facts).toContainEqual({ label: 'Next charge', value: 'None' })
  })

  it('names the renewal date on both live variants', () => {
    for (const bucket of ['active-monthly', 'active-annual'] as const) {
      const next = planCopy(bucket, plan()).facts.find((f) => f.label === 'Next charge')
      expect(next?.value, bucket).not.toBe('Soon')
    }
  })

  it('falls back to a vaguer answer rather than a wrong date', () => {
    const copy = planCopy('active-monthly', plan({ renewsAt: null }))
    expect(copy.facts).toContainEqual({ label: 'Next charge', value: 'Soon' })
  })

  /**
   * A live subscription's heading, price and fact rows already say all of it.
   * A sentence repeating them put the same date and the same price on the card
   * four times over.
   */
  it('does not repeat itself in prose on a live subscription', () => {
    expect(planCopy('active-monthly', plan()).lede).toBeUndefined()
    expect(planCopy('active-annual', plan()).lede).toBeUndefined()
  })

  it('keeps the explaining sentence on every state that needs one', () => {
    for (const bucket of ['free', 'cancelled', 'past-due', 'ended'] as const) {
      expect(planCopy(bucket, plan()).lede, bucket).toBeTruthy()
    }
  })

  /** The free card sells; every other card reports. */
  it('leaves the free state to the pitch rather than a table of nothing', () => {
    expect(planCopy('free', null).facts).toEqual([])
  })
})
