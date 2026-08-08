/**
 * Repair for subscription rows that webhooks lost.
 *
 * Creem retries failed deliveries, but a webhook can still be lost for good —
 * a deploy window, a bad response we returned, an endpoint misconfigured for an
 * hour. If webhooks were the only writer, one lost delivery would leave a row
 * permanently wrong: someone who cancelled keeping Pro, or worse, someone who
 * paid not getting it.
 *
 * Deliberately demand-driven rather than a Cron Trigger. A scheduled sweep would
 * walk every subscriber on a timer to fix accounts whose owners are not there to
 * notice; this repairs exactly the accounts someone is using, costs an integer
 * comparison when webhooks are working, and runs off the response path.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { creemApi, creemHeaders } from './creem'
import { patchFromSubscription, type CreemSubscription } from './webhook'

export const RECONCILE_STALE_MS = 24 * 60 * 60 * 1000

/**
 * The shortest gap between two Creem calls made on one user's behalf.
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
  ls_customer_id: string | null
  ls_updated_at: number | null
  ls_past_due_since: number | null
  ls_reconciled_at: number | null
}

async function getJson(url: string, apiKey: string): Promise<unknown | null> {
  const response = await fetch(url, {
    headers: creemHeaders(apiKey),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return null
  return response.json()
}

/**
 * The customer id for an address, when we do not already hold one.
 *
 * Only reached on the lost-first-webhook path: that user has no subscription
 * id and no customer id by definition, and the address they signed in with is
 * the sole thread back to what they bought.
 */
async function customerIdByEmail(apiKey: string, email: string): Promise<string | null> {
  const body = (await getJson(
    `${creemApi(apiKey)}/customers?email=${encodeURIComponent(email)}`,
    apiKey,
  )) as { id?: string } | null
  return body?.id ?? null
}

/**
 * Creem returns a list envelope from the search endpoint whose key has varied,
 * so the array is found rather than assumed. A shape we do not recognise
 * yields nothing and the row is simply left for the next attempt — the same
 * outcome as any other failed repair.
 */
function firstSubscription(body: unknown): CreemSubscription | null {
  const record = body as Record<string, unknown> | null
  if (!record) return null
  const list = [record.items, record.data, record.subscriptions].find(Array.isArray)
  return (list?.[0] as CreemSubscription) ?? null
}

/**
 * What Creem currently believes about this user's subscription.
 *
 * By id when we have one. Otherwise by customer — stored if a previous event
 * landed, else looked up from the address — which costs a second call but only
 * for the user whose first webhook never arrived.
 */
async function fetchSubscription(
  apiKey: string,
  subscriptionId: string | null,
  customerId: string | null,
  email: string | null,
): Promise<CreemSubscription | null> {
  const api = creemApi(apiKey)

  if (subscriptionId) {
    const body = (await getJson(
      `${api}/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
      apiKey,
    )) as CreemSubscription | null
    return body?.id ? body : null
  }

  const customer = customerId ?? (email ? await customerIdByEmail(apiKey, email) : null)
  if (!customer) return null

  return firstSubscription(
    await getJson(
      `${api}/subscriptions/search?customer_id=${encodeURIComponent(customer)}`,
      apiKey,
    ),
  )
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
  const columns = 'id, ls_customer_id, ls_updated_at, ls_past_due_since, ls_reconciled_at'
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
 * Ask Creem what the subscription actually is, and write it back.
 *
 * Pass `owner` to enable the repair for a user who has no `ls_subscription_id`
 * yet: their subscription is looked up by customer and adopted.
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
  const apiKey = process.env.CREEM_API_KEY?.trim()
  if (!apiKey) return

  try {
    const target = await loadTarget(db, subscriptionId, owner)
    if (!target) return
    if ((target.ls_reconciled_at ?? 0) + RECONCILE_COOLDOWN_MS > now) return

    // Stamped before the call, not after, so a hammered `?reconcile=1` spends a
    // cheap D1 write per request instead of a Creem request per request.
    await db
      .prepare('UPDATE users SET ls_reconciled_at = ? WHERE id = ?')
      .bind(now, target.id)
      .run()

    const subscription = await fetchSubscription(
      apiKey,
      subscriptionId,
      target.ls_customer_id,
      owner?.email ?? null,
    )
    if (!subscription) return

    // `now` as the observed time: a polled subscription carries no event
    // timestamp, and the object's own `updated_at` is preferred inside the
    // patch when Creem sends one.
    const patch = patchFromSubscription(subscription, target, now, now)
    if (!patch) return

    // Writes `ls_subscription_id` and `ls_customer_id` too, since the email
    // fallback exists to adopt a subscription the row does not have yet. Keyed
    // on the primary key so the adoption and the plain refresh are the same
    // statement. `ls_customer_id` coalesces rather than overwrites: a search
    // result with `customer` unexpanded would otherwise blank the id that
    // found it.
    await db
      .prepare(
        `UPDATE users SET
           ls_subscription_id = ?, ls_customer_id = COALESCE(?, ls_customer_id),
           ls_status = ?, ls_variant = ?, ls_renews_at = ?,
           ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.ls_subscription_id,
        patch.ls_customer_id,
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
