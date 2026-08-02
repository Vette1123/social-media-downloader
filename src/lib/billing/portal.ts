/**
 * A fresh signed customer-portal URL, per click.
 *
 * Lemon Squeezy signs these and expires them after 24 hours, and their docs say
 * not to store them — a cached URL would be a dead "Manage billing" button a day
 * after the last webhook.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import { SESSION_COOKIE, loadSession, readCookie } from '../auth/session'

/**
 * Whether a human is looking at this response.
 *
 * This endpoint is reached by clicking a link, so its failures are rendered by
 * a browser — and a browser renders `{"success":false,"error":"No
 * subscription"}` as exactly that, on a blank page, with no way back to the
 * site. `Sec-Fetch-Mode: navigate` is sent by every browser that supports it;
 * the Accept sniff covers the rest.
 */
function isNavigation(request: Request): boolean {
  if (request.headers.get('Sec-Fetch-Mode') === 'navigate') return true
  return (request.headers.get('Accept') ?? '').includes('text/html')
}

/**
 * Send a failed portal click back to the account page with a reason, so the
 * page can explain it in the site's own voice. Programmatic callers still get
 * the JSON they can act on.
 */
function portalFailure(
  request: Request,
  reason: 'none' | 'unavailable',
  error: string,
  status: number,
): Response {
  if (!isNavigation(request)) {
    return Response.json({ success: false, error }, { status })
  }
  const location = new URL(`/account?billing=${reason}`, request.url)
  return new Response(null, { status: 302, headers: { Location: location.toString() } })
}

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
    return portalFailure(
      request,
      'unavailable',
      'Billing is not configured on this deployment.',
      503,
    )
  }

  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    Date.now(),
  )
  if (!user?.ls_subscription_id) {
    return portalFailure(request, 'none', 'No subscription', 404)
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
    return portalFailure(
      request,
      'unavailable',
      'Could not open the billing portal. Try again.',
      502,
    )
  }
}
