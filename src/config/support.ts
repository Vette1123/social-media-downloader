/**
 * Which Buy Me a Coffee offers belong to *this* project.
 *
 * One account serves several projects, and every webhook endpoint on it
 * receives every event — endpoints subscribe to event types, not to levels. The
 * only per-purchase attribute the provider carries that we control is the name
 * of the thing bought, so each project tags its offers with its own short name
 * and recognises nothing else. That tag is the whole mechanism; there is no
 * shared database and no cross-project lookup.
 *
 * Written once, here. The webhook matches on it (`src/lib/billing/bmc.ts`) and
 * the support page prints it (`src/app/pro/page.tsx`), and the failure this
 * file exists to prevent is those two drifting apart from each other or from
 * the dashboard: a renamed offer stops every grant, with one log line to say so
 * and a supporter who paid to notice it.
 *
 * Its own file rather than a field on `siteConfig` so the Worker bundle does
 * not pull in the keyword list, and the support page does not pull in the
 * webhook.
 *
 * Copying this to another project: change `SUPPORT_TAG`, rename the two offers
 * in the dashboard to match, and nothing else moves.
 */
export const SUPPORT_TAG = 'Downloader'

/**
 * The recurring level, on the provider's Memberships shelf. $5 monthly or $50
 * yearly — the same prices in every project.
 */
export const SUPPORT_MEMBERSHIP = `${SUPPORT_TAG} — Supporter`

/**
 * The one-time purchase, on the Extras shelf rather than as a second membership
 * level. Two shelves keep the membership list at one card per project instead
 * of two, which is what makes the tag scheme survive a third and fourth
 * project. $35, once.
 */
export const SUPPORT_LIFETIME = `${SUPPORT_TAG} — Lifetime`

/**
 * What each one costs, in whole dollars, so the site and the dashboard cannot
 * disagree about the price of the thing it is linking to.
 *
 * The rule the numbers encode: a lifetime is a *multiple* of the yearly, never
 * a discount on it. At the first attempt it was $35 against a $50 yearly, which
 * kills the yearly outright and pays for itself in seven months — a permanent
 * grant sold for less than one year of the thing it replaces.
 */
export const SUPPORT_PRICES = { monthly: 5, yearly: 50, lifetime: 99 } as const
