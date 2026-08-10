/**
 * The route that used to start a purchase. There is nothing to purchase.
 *
 * Two merchants of record refused this product category, so the subscription
 * was withdrawn — see config/pro.ts. What is left is a redirect, and the
 * redirect is the whole point of keeping the route at all:
 *
 * 1. **Old links still exist.** The account page and /pro both pointed here,
 *    and so do any bookmarks, open tabs and installed PWA shells built before
 *    the change. Deleting the route would answer those with the Worker's 404 —
 *    or, worse, with the static export's, which is not a page anyone wants
 *    after clicking something labelled "Get Pro".
 *
 * 2. **A route reached by a click has to answer with a page.** Returning JSON
 *    to a browser following a link is the trap `clickResponse` exists for; this
 *    one is simple enough not to need it, because there is exactly one sensible
 *    destination and no failure mode.
 *
 * No database read, no session check, no `variant` parsing. Every one of those
 * existed to attach a buyer to a checkout, and there is no checkout — doing any
 * of them would be spending CPU on the way to the same redirect.
 */

/** GET /api/billing/checkout — permanently, the support page. */
export async function handleCheckout(_request: Request): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/pro',
      // A redirect with no per-user component, unlike the checkout 302 this
      // replaces. Still `no-store`: cached at the edge it would outlive a
      // future decision to point somewhere else.
      'Cache-Control': 'no-store',
    },
  })
}
