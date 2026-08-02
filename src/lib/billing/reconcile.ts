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
import { patchFromSubscription } from './webhook'

export const RECONCILE_STALE_MS = 24 * 60 * 60 * 1000

export function needsReconcile(
  row: { ls_subscription_id: string | null; ls_updated_at: number | null },
  now: number,
  forced: boolean,
): boolean {
  if (!row.ls_subscription_id) return false
  if (forced) return true
  return (row.ls_updated_at ?? 0) + RECONCILE_STALE_MS <= now
}

/**
 * Ask Lemon Squeezy what the subscription actually is, and write it back.
 *
 * Failures are swallowed: this runs inside `waitUntil` with no one to report to,
 * and a failed repair simply leaves the row as it was for the next attempt.
 */
export async function reconcileSubscription(
  db: D1Database,
  subscriptionId: string,
  now: number,
): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim()
  if (!apiKey) return

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) return

    const body = (await response.json()) as {
      data?: { id?: string; attributes?: Record<string, unknown> }
    }
    const current = await db
      .prepare('SELECT ls_updated_at, ls_past_due_since FROM users WHERE ls_subscription_id = ?')
      .bind(subscriptionId)
      .first<{ ls_updated_at: number | null; ls_past_due_since: number | null }>()

    const patch = patchFromSubscription(
      body.data?.id ?? subscriptionId,
      (body.data?.attributes ?? {}) as never,
      null,
      current,
      now,
    )
    if (!patch) return

    await db
      .prepare(
        `UPDATE users SET
           ls_status = ?, ls_variant = ?, ls_renews_at = ?,
           ls_ends_at = ?, ls_past_due_since = ?, ls_updated_at = ?
         WHERE ls_subscription_id = ?`,
      )
      .bind(
        patch.ls_status,
        patch.ls_variant,
        patch.ls_renews_at,
        patch.ls_ends_at,
        patch.ls_past_due_since,
        patch.ls_updated_at,
        subscriptionId,
      )
      .run()
  } catch {
    // Nothing to do — the next refresh tries again.
  }
}
