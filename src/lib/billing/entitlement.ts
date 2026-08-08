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
  sub_status: string | null
  sub_ends_at: number | null
  sub_past_due_since: number | null
}

/**
 * Whether a period the customer has already paid for is still running.
 *
 * Shared with the account page's plan classifier, so "is still Pro" and "still
 * reads as Pro on screen" cannot drift apart — they are one comparison in one
 * place rather than the same `<` written twice.
 */
export function paidThrough(endsAt: number | null, now: number): boolean {
  return endsAt !== null && now < endsAt
}

/**
 * A `switch` rather than chained ternaries, and an explicit `default: false`,
 * so a status Creem adds later fails closed instead of matching some broader
 * condition by accident.
 */
export function isProAt(row: BillingRow | null, now: number): boolean {
  if (!row?.sub_status) return false

  switch (row.sub_status) {
    case 'active':
    case 'trialing':
      return true

    // The two ways Creem says "cancelled", both of which keep Pro to the end of
    // the period that has been paid for.
    //
    // `scheduled_cancel` is what its API writes in `scheduled` mode: stops
    // renewing, keeps running. `canceled` is what its *customer portal* writes
    // the instant someone clicks Cancel there — immediately, with
    // `current_period_end_date` still eleven months out on an annual plan. Creem
    // considers that status final; we do not, because the money is not.
    //
    // Reading them alike is deliberate and is the whole guarantee: someone
    // charged for twelve months gets twelve months, whichever Cancel button they
    // found. It cannot outlive the period either, since Creem moves a lapsed
    // subscription to `expired`, and a past `sub_ends_at` fails the comparison
    // anyway.
    //
    // ponytail: a refund does not move the status, so a refunded annual would
    // keep Pro to period end. `refund.created` is deliberately unsubscribed and
    // the stated policy is that charges are final — subscribe to it and clear
    // `sub_ends_at` if refunds ever stop being an exception.
    case 'scheduled_cancel':
    case 'canceled':
      return paidThrough(row.sub_ends_at, now)

    // A null start means we never observed the transition, so there is no
    // window to measure. Fail closed rather than grant an unbounded grace.
    case 'past_due':
      return (
        row.sub_past_due_since !== null &&
        now < row.sub_past_due_since + PAST_DUE_GRACE_MS
      )

    // `expired`, `unpaid`, `paused` — all stopped with nothing left paid for,
    // all failing here by falling through rather than by being listed, so a new
    // stopped-ish status Creem introduces lands on the safe side too.
    default:
      return false
  }
}
