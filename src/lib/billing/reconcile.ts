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
import { applySubscriptionPatch, patchFromSubscription, type CreemSubscription } from './webhook'

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
 * and nothing happened". `reconcileSubscription` finds theirs by searching
 * for them. The outbound call is bounded by `RECONCILE_COOLDOWN_MS`, not by
 * this predicate.
 */
export function needsReconcile(
  row: { sub_id: string | null; sub_updated_at: number | null },
  now: number,
  forced: boolean,
): boolean {
  if (forced) return true
  if (!row.sub_id) return false
  return (row.sub_updated_at ?? 0) + RECONCILE_STALE_MS <= now
}

/** The signed-in user, when the caller has one. Lets the search below match. */
export interface ReconcileOwner {
  id: string
  email: string | null
}

interface TargetRow {
  id: string
  sub_customer_id: string | null
  sub_variant: string | null
  sub_updated_at: number | null
  sub_past_due_since: number | null
  sub_reconciled_at: number | null
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
 * How far the search is willing to walk.
 *
 * `/v1/subscriptions/search` takes no filter of any kind, so finding one
 * subscription means paging the whole store and matching locally. These bounds
 * cap that at 500 subscriptions, newest first.
 *
 * ponytail: linear scan, capped. Only the lost-first-webhook path reaches it,
 * and only once a minute per user, so it is one request in practice. If the
 * store ever outgrows 500 live subscriptions, ask Creem for a filter rather
 * than raising this — an uncapped scan on a public endpoint is a way to get
 * the API key rate-limited.
 */
const SEARCH_PAGE_SIZE = 100
const SEARCH_MAX_PAGES = 5

interface SearchPage {
  items?: CreemSubscription[]
  pagination?: { next_page?: number | null }
}

/**
 * Whether this subscription belongs to the user we are repairing.
 *
 * `metadata.user_id` is ours, put there by the checkout link, and it is the
 * binding to trust. Email is the fallback for a purchase that somehow arrived
 * without it, and is compared case-insensitively because an address that
 * differs only in case is the same mailbox.
 */
function belongsTo(
  subscription: CreemSubscription,
  ownerId: string,
  email: string | null,
  customerId: string | null,
): boolean {
  if (subscription.metadata?.user_id === ownerId) return true

  const customer = expandedCustomer(subscription)
  if (customerId && customer?.id === customerId) return true
  if (!email || !customer?.email) return false
  return customer.email.toLowerCase() === email.toLowerCase()
}

function expandedCustomer(
  subscription: CreemSubscription,
): { id?: string; email?: string } | null {
  const customer = subscription.customer
  return customer && typeof customer === 'object' ? customer : null
}

/**
 * The user's subscription, found by walking the store.
 *
 * Creem has no way to ask "what does this customer have": `/v1/customers` can
 * turn an address into a customer, but nothing accepts that customer as a
 * filter — `/v1/subscriptions` takes only a subscription id, and the search
 * endpoint rejects every property except paging with a 400. Since each search
 * item arrives with `customer` expanded and our own `metadata` attached, the
 * match is done here instead, which also removes the address lookup entirely.
 */
async function findSubscription(
  apiKey: string,
  ownerId: string,
  email: string | null,
  customerId: string | null,
): Promise<CreemSubscription | null> {
  const api = creemApi(apiKey)

  for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
    const body = (await getJson(
      `${api}/subscriptions/search?page_number=${page}&page_size=${SEARCH_PAGE_SIZE}`,
      apiKey,
    )) as SearchPage | null

    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) return null

    const match = items.find((item) => belongsTo(item, ownerId, email, customerId))
    if (match) return match

    if (!body?.pagination?.next_page) return null
  }
  return null
}

/**
 * What Creem currently believes about this user's subscription.
 *
 * By id when we have one, which is one request and the overwhelmingly common
 * case. The search walk below is only for the user whose first webhook never
 * arrived, so they have no id to ask by.
 */
async function fetchSubscription(
  apiKey: string,
  subscriptionId: string | null,
  customerId: string | null,
  owner: ReconcileOwner | null | undefined,
): Promise<CreemSubscription | null> {
  if (subscriptionId) {
    const body = (await getJson(
      `${creemApi(apiKey)}/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
      apiKey,
    )) as CreemSubscription | null
    return body?.id ? body : null
  }

  if (!owner) return null
  return findSubscription(apiKey, owner.id, owner.email, customerId)
}

/**
 * Prefer the owner's primary key when the caller knows who is asking — it is
 * the only key that stays correct while `sub_id` is null or about
 * to change. `sub_id` is UNIQUE, so the fallback is still one row.
 */
async function loadTarget(
  db: D1Database,
  subscriptionId: string | null,
  owner: ReconcileOwner | null | undefined,
): Promise<TargetRow | null> {
  const columns =
    'id, sub_customer_id, sub_variant, sub_updated_at, sub_past_due_since, sub_reconciled_at'
  if (owner) {
    return db.prepare(`SELECT ${columns} FROM users WHERE id = ?`).bind(owner.id).first<TargetRow>()
  }
  if (!subscriptionId) return null
  return db
    .prepare(`SELECT ${columns} FROM users WHERE sub_id = ?`)
    .bind(subscriptionId)
    .first<TargetRow>()
}

/**
 * Ask Creem what the subscription actually is, and write it back.
 *
 * Pass `owner` to enable the repair for a user who has no `sub_id`
 * yet: their subscription is found by searching the store and adopted.
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
    if ((target.sub_reconciled_at ?? 0) + RECONCILE_COOLDOWN_MS > now) return

    // Stamped before the call, not after, so a hammered `?reconcile=1` spends a
    // cheap D1 write per request instead of a Creem request per request.
    await db
      .prepare('UPDATE users SET sub_reconciled_at = ? WHERE id = ?')
      .bind(now, target.id)
      .run()

    const subscription = await fetchSubscription(
      apiKey,
      subscriptionId,
      target.sub_customer_id,
      owner,
    )
    if (!subscription) return

    // `now` as the observed time: a polled subscription carries no event
    // timestamp, and the object's own `updated_at` is preferred inside the
    // patch when Creem sends one.
    const patch = patchFromSubscription(subscription, target, now, now)
    if (!patch) return

    // Writes `sub_id` and `sub_customer_id` too, since the email fallback exists
    // to adopt a subscription the row does not have yet — so the adoption and the
    // plain refresh are the same statement, the one the webhook also writes.
    await applySubscriptionPatch(db, target.id, patch)
  } catch {
    // Nothing to do — the next refresh tries again.
  }
}
