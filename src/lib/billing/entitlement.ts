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
 * Lemon Squeezy retries four times over two weeks before flipping a
 * subscription to `unpaid`, and most of those retries succeed — an expired card
 * is the largest single cause of involuntary churn and is not a decision to
 * leave. The cap is ours rather than theirs so that a changed retry schedule, a
 * wedged subscription, or a webhook that never lands cannot mean unbounded free
 * service. In normal operation Lemon Squeezy resolves the subscription first and
 * this never fires.
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
 * so a status Lemon Squeezy adds later fails closed instead of matching some
 * broader condition by accident.
 */
export function isProAt(row: BillingRow | null, now: number): boolean {
  if (!row?.ls_status) return false

  switch (row.ls_status) {
    case 'active':
    case 'on_trial':
      return true

    // "Cancelled" in Lemon Squeezy means *will not renew*, not *stopped now*.
    // The customer has already paid through the end of the period.
    case 'cancelled':
      return row.ls_ends_at !== null && now < row.ls_ends_at

    // A null start means we never observed the transition, so there is no
    // window to measure. Fail closed rather than grant an unbounded grace.
    case 'past_due':
      return (
        row.ls_past_due_since !== null &&
        now < row.ls_past_due_since + PAST_DUE_GRACE_MS
      )

    default:
      return false
  }
}
