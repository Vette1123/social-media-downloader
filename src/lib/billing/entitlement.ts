/**
 * Who is Pro, and until when. The only place in the codebase that decides.
 *
 * Kept pure and dependency-free so it can be exhaustively unit-tested: a bug
 * here either hands out paid features or takes them from someone who paid, and
 * neither shows up in a smoke test.
 */

/**
 * How long a failed payment keeps Pro alive.
 *
 * A card that expired is the largest single cause of involuntary churn and is
 * not a decision to leave, so a `past_due` subscription keeps Pro while the
 * provider retries the charge. The cap is ours rather than theirs so that a
 * changed retry schedule, a wedged subscription, or a webhook that never lands
 * cannot mean unbounded free service. In normal operation Creem resolves the
 * subscription — to `active` or to `unpaid` — long before this fires.
 */
export const PAST_DUE_GRACE_MS = 14 * 24 * 60 * 60 * 1000

/** The subset of the `users` row that entitlement depends on. */
export interface BillingRow {
  ls_status: string | null
  ls_ends_at: number | null
  ls_past_due_since: number | null
}

/**
 * A `switch` rather than chained ternaries, and an explicit `default: false`,
 * so a status Creem adds later fails closed instead of matching some broader
 * condition by accident.
 *
 * Note `scheduled_cancel` versus `canceled`. They are two different states, not
 * two names for one: `scheduled_cancel` is a subscription that will not renew
 * but is still running to the end of a period the customer paid for, while
 * `canceled` has already stopped. Treating them alike in either direction bills
 * nobody and silently keeps or revokes Pro, so each is matched explicitly and
 * only the first consults `ls_ends_at`.
 */
export function isProAt(row: BillingRow | null, now: number): boolean {
  if (!row?.ls_status) return false

  switch (row.ls_status) {
    case 'active':
    case 'trialing':
      return true

    // Cancelled but not yet lapsed: the customer has already paid through the
    // end of the current period and keeps Pro until it runs out.
    case 'scheduled_cancel':
      return row.ls_ends_at !== null && now < row.ls_ends_at

    // A null start means we never observed the transition, so there is no
    // window to measure. Fail closed rather than grant an unbounded grace.
    case 'past_due':
      return (
        row.ls_past_due_since !== null &&
        now < row.ls_past_due_since + PAST_DUE_GRACE_MS
      )

    // `canceled`, `expired`, `unpaid`, `paused` — all stopped, all fail here
    // by falling through rather than by being listed, so a new stopped-ish
    // status Creem introduces lands on the safe side too.
    default:
      return false
  }
}
