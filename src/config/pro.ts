/**
 * Pro's commercial constants, in one place.
 *
 * Two variants, one entitlement. Annual is presented first everywhere: Creem
 * charges roughly 4% + 40¢, so the flat fee takes 17% of a $3 charge and 2% of
 * a $24 one — twelve monthly renewals net $28.80 against $23.20 for an annual,
 * which makes annual worth 81% of the revenue while removing eleven chances to
 * churn and eleven flat fees.
 */

// Creem product share links. The product name carries the plan — "Annual"
// is what `variantOf` in billing/webhook.ts matches on — so renaming a
// product, from the dashboard or over the API, silently relabels the plan on
// the account page. Any future name for the yearly product must keep the word
// "annual" or "year" in it.
export const PRO_CHECKOUT_MONTHLY = 'https://creem.io/product/prod_YlRkuWMTOagrCSiGSzdwU'
export const PRO_CHECKOUT_ANNUAL = 'https://creem.io/product/prod_5UH0C3CxN8uL0HTlRCTuhG'

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
 * `userId` is the account's internal id and is the only binding the webhook
 * trusts. It rides in Creem's `metadata[...]` bracket syntax, which a
 * shareable payment link accepts as a query parameter and hands back on every
 * subscription event.
 *
 * Creem's payment links take no email prefill, so unlike the previous
 * provider there is nothing to pass here but the id — which was always the
 * part that mattered. The webhook's email path is a last-resort fallback that
 * can never seize a row already holding a subscription; see `mayApply`.
 * Callers must never pass an empty id; see `buyerOf` in AccountPanel.
 */
export function checkoutHref(base: string, userId: string): string {
  const url = new URL(base)
  url.searchParams.set('metadata[user_id]', userId)
  return url.toString()
}
