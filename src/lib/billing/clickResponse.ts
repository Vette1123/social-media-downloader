/**
 * Failure responses for billing routes that a human reaches by clicking.
 *
 * `/api/billing/portal` and `/api/billing/checkout` are both plain `<a href>`
 * targets — they have to be, because the static export cannot route a
 * `next/link` at an API path, and because each has to be built server-side per
 * click. That makes their error paths a browser problem rather than a client
 * problem: a browser renders `{"success":false,"error":"No subscription"}` as
 * exactly that, on a blank white page, with no way back to the site.
 *
 * So both send a navigating visitor back to /account with a reason the page can
 * phrase in the site's own voice, and keep the JSON for programmatic callers.
 * Shared here because the second copy of this is how the two drift apart.
 */

/** Why a billing click could not be completed. The account page maps these to copy. */
export type BillingFailureReason = 'none' | 'unavailable'

/**
 * Whether a human is looking at this response.
 *
 * `Sec-Fetch-Mode: navigate` is sent by every browser that supports it; the
 * Accept sniff covers the rest.
 */
export function isNavigation(request: Request): boolean {
  if (request.headers.get('Sec-Fetch-Mode') === 'navigate') return true
  return (request.headers.get('Accept') ?? '').includes('text/html')
}

export function billingFailure(
  request: Request,
  reason: BillingFailureReason,
  error: string,
  status: number,
): Response {
  if (!isNavigation(request)) {
    return Response.json({ success: false, error }, { status })
  }
  const location = new URL(`/account?billing=${reason}`, request.url)
  return new Response(null, { status: 302, headers: { Location: location.toString() } })
}
