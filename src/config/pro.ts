/**
 * Pro's commercial constants, in one place.
 *
 * Two variants, one entitlement. Annual is presented first everywhere: Lemon
 * Squeezy charges 5% + 50¢, so the flat fee takes 22% of a $3 charge and 7% of
 * a $24 one — twelve monthly renewals net $28.20 against $22.30 for an annual,
 * which makes annual worth 79% of the revenue while removing eleven chances to
 * churn and eleven flat fees.
 */

export const PRO_CHECKOUT_MONTHLY = 'TEMPLATE_LS_MONTHLY_URL'
export const PRO_CHECKOUT_ANNUAL = 'TEMPLATE_LS_ANNUAL_URL'

export const PRO_PRICE_MONTHLY = '$3'
export const PRO_PRICE_ANNUAL = '$24'

/** One label for one intent, used at every entry point. */
export const PRO_CTA_LABEL = `Get Pro, ${PRO_PRICE_MONTHLY}/mo`

export function isProCheckoutConfigured(url: string): boolean {
  return url.startsWith('https://')
}

/**
 * Attach the buyer to the checkout so the webhook can find them.
 *
 * `userId` is the account's internal id and is what the webhook matches on.
 * The email is a prefill and nothing more: the buyer can edit it at checkout,
 * and paying with PayPal substitutes that account's address — so a checkout
 * built without an id can produce a purchase that matches no row at all.
 * Callers must never pass an empty one; see `buyerOf` in AccountPanel.
 */
export function checkoutHref(base: string, userId: string, email: string): string {
  const url = new URL(base)
  url.searchParams.set('checkout[custom][user_id]', userId)
  url.searchParams.set('checkout[email]', email)
  return url.toString()
}
