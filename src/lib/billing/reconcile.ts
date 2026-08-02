/**
 * Repair for subscription rows that webhooks lost.
 *
 * Lemon Squeezy retries failed deliveries, but a webhook can still be lost for
 * good — a deploy window, a bad response we returned, an endpoint misconfigured
 * for an hour. If webhooks were the only writer, one lost delivery would leave a
 * row permanently wrong: someone who cancelled keeping Pro, or worse, someone
 * who paid not getting it.
 *
 * Deliberately demand-driven rather than a Cron Trigger. A scheduled sweep would
 * walk every subscriber on a timer to fix accounts whose owners are not there to
 * notice; this repairs exactly the accounts someone is using, costs an integer
 * comparison when webhooks are working, and runs off the response path.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { patchFromSubscription, type SubscriptionAttributes } from './webhook'

export const RECONCILE_STALE_MS = 24 * 60 * 60 * 1000

/**
 * The shortest gap between two Lemon Squeezy calls made on one user's behalf.
 *
 * `forced` comes from `?reconcile=1`, a query parameter the client controls, so
 * without a bound a loop of `POST /api/auth/refresh?reconcile=1` is one
 * outbound call per request against our account-wide API key — enough to get it
 * rate-limited and take the portal down for everyone. A minute is longer than
 * the checkout poll's whole 30-second window, so a real customer spends exactly
 * one call on the repair they came for.
 */
export const RECONCILE_COOLDOWN_MS = 60 * 1000

/**
 * `forced` no longer requires a stored subscription id.
 *
 * Only a webhook ever writes that id, so the user whose very first webhook was
 * lost is precisely the user with no id — and they are the one asking "I paid
 * and nothing happened". `reconcileSubscription` falls back to an email lookup
 * for them. The outbound call is bounded by `RECONCILE_COOLDOWN_MS`, not by
 * this predicate.
 */
export function needsReconcile(
  row: { ls_subscription_id: string | null; ls_updated_at: number | null },
  now: number,
  forced: boolean,
): boolean {
  if (forced) return true
  if (!row.ls_subscription_id) return false
  return (row.ls_updated_at ?? 0) + RECONCILE_STALE_MS <= now
}

/** The signed-in user, when the caller has one. Lets the email fallback work. */
export interface ReconcileOwner {
  id: string
  email: string | null
}

interface TargetRow {
  id: string
  ls_updated_at: number | null
  ls_past_due_since: number | null
  ls_reconciled_at: number | null
}

interface LsSubscription {
  id?: string
  attributes?: SubscriptionAttributes
}

const LS_API = 'https://api.lemonsqueezy.com/v1/subscriptions'

/**
 * By id when we have one, otherwise by the address the account signed in with.
 * The list endpoint returns subscriptions ordered `created_at` descending, so
 * the first result is the most recent one they bought.
 */
function subscriptionUrl(subscriptionId: string | null, email: string | null): string | null {
  if (subscriptionId) return `${LS_API}/${encodeURIComponent(subscriptionId)}`
  if (email) return `${LS_API}?filter[user_email]=${encodeURIComponent(email)}`
  return null
}

function firstSubscription(
  data: LsSubscription | LsSubscription[] | undefined,
): LsSubscription | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

async function fetchSubscription(
  apiKey: string,
  subscriptionId: string | null,
  email: string | null,
): Promise<LsSubscription | null> {
  const url = subscriptionUrl(subscriptionId, email)
  if (!url) return null

  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return null

  const body = (await response.json()) as { data?: LsSubscription | LsSubscription[] }
  return firstSubscription(body.data)
}

/**
 * Prefer the owner's primary key when the caller knows who is asking — it is
 * the only key that stays correct while `ls_subscription_id` is null or about
 * to change. `ls_subscription_id` is UNIQUE, so the fallback is still one row.
 */
async function loadTarget(
  db: D1Database,
  subscriptionId: string | null,
  owner: ReconcileOwner | null | undefined,
): Promise<TargetRow | null> {
  const columns = 'id, ls_updated_at, ls_past_due_since, ls_reconciled_at'
  if (owner) {
    return db.prepare(`SELECT ${columns} FROM users WHERE id = ?`).bind(owner.id).first<TargetRow>()
  }
  if (!subscriptionId) return null
  return db
    .prepare(`SELECT ${columns} FROM users WHERE ls_subscription_id = ?`)
    .bind(subscriptionId)
    .first<TargetRow>()
}

/**
 * Ask Lemon Squeezy what the subscription actually is, and write it back.
 *
 * Pass `owner` to enable the repair for a user who has no `ls_subscription_id`
 * yet: their subscription is looked up by email and adopted.
 *
 * Failures are swallowed: this runs inside `waitUntil` with no one to report to,
 * and a failed repair simply leaves the row as it was for the next attempt.
 */
export async function reconcileSubscription(
  db: D1Database,
  subscriptionId: string | null,
  now: number,
  owner?: ReconcileOwner | null,
): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim()
  if (!apiKey) return

  try {
    const target = await loadTarget(db, subscriptionId, owner)
    if (!target) return
    if ((target.ls_reconciled_at ?? 0) + RECONCILE_COOLDOWN_MS > now) return

    // Stamped before the call, not after, so a hammered `?reconcile=1` spends a
    // cheap D1 write per request instead of a Lemon Squeezy request per request.
    await db
      .prepare('UPDATE users SET ls_reconciled_at = ? WHERE id = ?')
      .bind(now, target.id)
      .run()

    const subscription = await fetchSubscription(apiKey, subscriptionId, owner?.email ?? null)
    if (!subscription) return

    const patch = patchFromSubscription(
      subscription.id ?? subscriptionId,
      subscription.attributes ?? {},
      null,
      target,
      now,
    )
    if (!patch) return

    // Writes `ls_subscription_id` too, since the email fallback exists to adopt
    // one the row does not have yet. Keyed on the primary key so the adoption
    // and the plain refresh are the same statement.
    await db
      .prepare(
        `UPDATE users SET
           ls_subscription_id = ?, ls_status = ?, ls_variant = ?, ls_renews_at = ?,
           ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.ls_subscription_id,
        patch.ls_status,
        patch.ls_variant,
        patch.ls_renews_at,
        patch.ls_ends_at,
        patch.ls_past_due_since,
        patch.ls_updated_at,
        target.id,
      )
      .run()
  } catch {
    // Nothing to do — the next refresh tries again.
  }
}
