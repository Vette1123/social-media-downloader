/**
 * Pro's commercial constants, in one place.
 *
 * The checkout URL, the price and the button label are now shown on the home
 * page, on every platform landing page and on /pro. Four copies of a price is
 * three chances to advertise $9 next to a $12 checkout, and one CTA worded
 * three ways ("Buy Pro", "Get Pro", "Upgrade") reads as three different offers
 * rather than one.
 *
 * The URL is verified by `pnpm ls:finish`, which re-checks the live variant's
 * price and license settings against what these strings claim before it will
 * rewrite the value here.
 */

/**
 * The live Lemon Squeezy hosted checkout: the product's own `buy_now_url`,
 * which is the only URL shape that resolves (the legacy `/buy/<variant-id>`
 * form 404s). If this is ever reset to a TEMPLATE_ value, /pro shows a visibly
 * disabled button rather than linking somewhere broken.
 */
export const PRO_CHECKOUT_URL =
  'https://gadolabs.lemonsqueezy.com/checkout/buy/00f77321-26bd-411c-9924-81c8256b819b'

export const PRO_PRICE = '$9'

/** One label for one intent, used at every entry point. */
export const PRO_CTA_LABEL = `Get Pro, ${PRO_PRICE}`

export function isProCheckoutConfigured(url: string = PRO_CHECKOUT_URL): boolean {
  return url.startsWith('https://')
}
