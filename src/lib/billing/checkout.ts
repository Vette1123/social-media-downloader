/**
 * The start of a purchase, as a server round trip rather than a bare link.
 *
 * The account page used to link straight at Creem, with the product id baked
 * into the static bundle. That cost two things this route buys back:
 *
 * 1. **The store follows the key.** A bundle carrying live product links while
 *    the Worker holds a test key charges a real card for a subscription the
 *    webhook cannot verify and the repair path cannot see. Building the link
 *    here, from `CREEM_API_KEY`, makes that combination unrepresentable.
 *
 * 2. **We find out that someone tried to buy.** `sub_id` is only ever written
 *    by a webhook, so a buyer whose first webhook is lost has no id — and
 *    `needsReconcile` used to answer "nothing to repair" for exactly that
 *    person, forever. Stamping the attempt before the redirect gives the
 *    repair a reason to go looking for them; see reconcile.ts.
 *
 * The stamp is deliberately written before the redirect and never cleared on
 * failure. Someone who opens checkout and abandons it costs one bounded search
 * per minute for a few days; someone who pays and loses the webhook gets their
 * subscription. That trade only has one sensible direction.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import { loadSession, sessionCookieOf } from '../auth/session'
import { checkoutHref, isProVariant, proCheckoutBase } from '@/config/pro'
import { billingFailure } from './clickResponse'
import { isCreemTestKey } from './creem'

/** GET /api/billing/checkout?variant=annual|monthly */
export async function handleCheckout(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const apiKey = process.env.CREEM_API_KEY?.trim()
  if (!apiKey) {
    return billingFailure(request, 'unavailable', 'Billing is not configured on this deployment.', 503)
  }

  const variant = new URL(request.url).searchParams.get('variant')
  if (!isProVariant(variant)) {
    return billingFailure(request, 'unavailable', 'Unknown plan.', 400)
  }

  // A signed-out click cannot become a purchase: `metadata.user_id` is the only
  // binding the webhook trusts, and there is no id to attach. Sending them to
  // the account page is what the sign-in flow already lands on.
  const user = await loadSession(db, sessionCookieOf(request), Date.now())
  if (!user) {
    return billingFailure(request, 'none', 'Sign in first.', 401)
  }

  await db
    .prepare('UPDATE users SET sub_checkout_at = ? WHERE id = ?')
    .bind(Date.now(), user.id)
    .run()

  const href = checkoutHref(proCheckoutBase(isCreemTestKey(apiKey), variant), user.id)
  // No-store: this 302 is per-user and per-click. A cached copy would send the
  // next visitor to a checkout carrying someone else's user id.
  return new Response(null, {
    status: 302,
    headers: { Location: href, 'Cache-Control': 'no-store' },
  })
}
