/**
 * A fresh signed customer-portal URL, per click.
 *
 * Creem mints these per request and expires them, so nothing here is cached —
 * a stored URL would be a dead "Manage billing" button by the time anyone
 * pressed it.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import { loadSession, sessionCookieOf } from '../auth/session'
import { creemApi, creemHeaders } from './creem'

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

/**
 * Creem documents the field as `customer_portal_link`, but the response is
 * read defensively: a portal click that 502s because the key was renamed is a
 * paying customer who cannot reach their own billing, and the fallbacks cost
 * one property read each.
 */
function portalUrlOf(body: unknown): string | null {
  const record = body as Record<string, unknown> | null
  const candidate = record?.customer_portal_link ?? record?.url ?? record?.link
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

/** GET /api/billing/portal */
export async function handlePortal(
  request: Request,
  _ctx?: unknown,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const apiKey = process.env.CREEM_API_KEY?.trim()
  if (!apiKey) {
    return portalFailure(
      request,
      'unavailable',
      'Billing is not configured on this deployment.',
      503,
    )
  }

  const user = await loadSession(db, sessionCookieOf(request), Date.now())
  // Creem generates the portal for a *customer*, so the customer id is what
  // this needs — not the subscription id. Both are written by the same
  // webhook, so a user missing this one has never had a purchase land.
  if (!user?.sub_customer_id) {
    return portalFailure(request, 'none', 'No subscription', 404)
  }

  try {
    const response = await fetch(`${creemApi(apiKey)}/customers/billing`, {
      method: 'POST',
      headers: { ...creemHeaders(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: user.sub_customer_id }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('upstream')

    const portal = portalUrlOf(await response.json())
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
