/**
 * How somebody becomes a supporter, and what it costs.
 *
 * The old payment provider suspended the account on 2026-11-06, so until a new
 * one is in place support is arranged by EMAIL: every support button opens a
 * pre-addressed mail to `PRO_EMAIL`, the reply says how to pay, and the owner
 * switches the extras on by hand with `pnpm pro <address>`
 * (scripts/grant-pro.mjs). That writes the same `supporters` row every earlier
 * supporter already has, so nobody who paid before loses anything, and an
 * address with no account yet is claimed on its first sign-in
 * (src/lib/billing/supporters.ts).
 *
 * Its own file rather than a field on `siteConfig` so the Worker bundle does
 * not pull it in.
 */
export const SUPPORT_TAG = 'Downloader'

/** Where a request to support goes. One constant; every support button reads it. */
export const PRO_EMAIL = 'booogado@gmail.com'

/** The plans, as the subject line names them. */
export type ProPlan = 'Monthly or yearly' | 'Lifetime' | 'Any plan'

/**
 * A pre-filled mail asking to support: the plan in the subject, and the address
 * to switch on in the body, because the extras are granted to the sign-in email
 * and a request that does not name it costs a round trip.
 */
export function proMailto(plan: ProPlan, accountEmail: string | null = null): string {
  const subject = `${SUPPORT_TAG} supporter — ${plan}`
  const body = [
    `Hi, I would like to support Social Media Downloader (${plan}).`,
    '',
    `The email I sign in with: ${accountEmail ?? ''}`,
    '',
  ].join('\n')
  return `mailto:${PRO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * What each plan costs, in whole dollars. A lifetime is a *multiple* of the
 * yearly, never a discount on it: priced under the annual it kills the annual
 * and pays for itself inside a year.
 */
export const SUPPORT_PRICES = { monthly: 5, yearly: 50, lifetime: 99 } as const

/**
 * The four benefits the home/platform support panel shows, by position in the
 * benefit list (every locale keeps the same order). The panel's copy says
 * "switches these four on", and it used to list all twelve under that sentence
 * (14 Nov), eight screens of bullets on a phone. The full list lives on /pro.
 */
export const PANEL_BENEFIT_INDEXES = [0, 5, 6, 9] as const

export function panelBenefits<T>(all: readonly T[]): T[] {
  return PANEL_BENEFIT_INDEXES.map((i) => all[i]).filter((b): b is T => b !== undefined)
}
