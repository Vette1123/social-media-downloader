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
  /** Hand-set capabilities. See migration 0007 and `hasGrant`. */
  grants?: string | null
}

/**
 * A capability granted by hand rather than bought.
 *
 * `pro` is what a supporter gets; `ig` attaches the operator's own Instagram
 * session to that account's resolves and is deliberately not something anyone
 * can obtain by paying — see the migration for why that distinction is load
 * bearing rather than bookkeeping.
 */
export type Grant = 'pro' | 'ig'

/**
 * Exact membership in a comma-separated set, not a substring test.
 *
 * `includes('pro')` on the raw string would match a future grant merely
 * containing those letters, which is the classic way a capability check starts
 * saying yes to things nobody granted.
 */
export function hasGrant(row: { grants?: string | null } | null, grant: Grant): boolean {
  if (!row?.grants) return false
  return row.grants.split(',').some((name) => name.trim() === grant)
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
    // ponytail: a refund does not move the status, so a refunded annual keeps
    // Pro to period end unless someone intervenes. Since /terms started
    // offering a 14-day refund (2026-08-10, for the Creem account review) that
    // is a real hole, deliberately left to a manual step rather than code.
    // Refunds arrive by email, one at a time, and revoking is one command run
    // straight after issuing the refund in Creem. `sub_updated_at` is bumped
    // with it so a late webhook redelivery cannot undo the revoke:
    //
    //   pnpm exec wrangler d1 execute social-media-downloader --remote \
    //     --command "UPDATE users SET sub_ends_at = strftime('%s','now')*1000,
    //       sub_updated_at = strftime('%s','now')*1000 WHERE email = 'buyer@example.com'"
    //
    // Not automated on purpose: Creem documents `refund.created` as an event
    // but not its payload down to the subscription id, and a handler written
    // against a guessed shape would also have to tell a partial refund from a
    // full one — refunding one month of an annual as goodwill must not take the
    // other eleven away. Subscribe to `refund.created` and clear `sub_ends_at`
    // there once that payload is confirmed against a real refund, if refunds
    // ever stop being rare enough to handle by hand.
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

/**
 * Whether this account gets Pro's features right now, from any source.
 *
 * Deliberately separate from `isProAt` rather than folded into it. `isProAt`
 * answers "what does this *subscription* entitle", and `mayApply` in webhook.ts
 * depends on exactly that reading to decide whether an incoming event may
 * supersede a stored subscription. A hand grant is not a subscription and must
 * not be able to block a webhook, so it lives out here where only the callers
 * that ask about features can see it.
 *
 * With payments withdrawn this is, in practice, the grant alone — no row has a
 * subscription. The subscription arm stays because it costs one call and is the
 * half that must keep working if a processor is ever found.
 */
export function isEntitled(row: BillingRow | null, now: number): boolean {
  return hasGrant(row, 'pro') || isProAt(row, now)
}
