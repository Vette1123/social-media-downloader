/**
 * A fresh signed customer-portal URL, per click.
 *
 * Lemon Squeezy signs these and expires them after 24 hours, and their docs say
 * not to store them — a cached URL would be a dead "Manage billing" button a day
 * after the last webhook.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import { SESSION_COOKIE, loadSession, readCookie } from '../auth/session'

/** GET /api/billing/portal */
export async function handlePortal(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { success: false, error: 'Billing is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    Date.now(),
  )
  if (!user?.ls_subscription_id) {
    return Response.json({ success: false, error: 'No subscription' }, { status: 404 })
  }

  try {
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.ls_subscription_id}`,
      {
        headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!response.ok) throw new Error('upstream')

    const body = (await response.json()) as {
      data?: { attributes?: { urls?: { customer_portal?: string } } }
    }
    const portal = body.data?.attributes?.urls?.customer_portal
    if (!portal) throw new Error('no portal url')

    return new Response(null, { status: 302, headers: { Location: portal } })
  } catch {
    return Response.json(
      { success: false, error: 'Could not open the billing portal. Try again.' },
      { status: 502 },
    )
  }
}
