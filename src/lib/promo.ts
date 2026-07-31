import type { Offer, OfferPlacement } from '@/config/offers'

/** A dismissal suppresses the slot for a week, not forever. */
export const PROMO_DISMISS_MS = 7 * 24 * 60 * 60 * 1000
export const PROMO_DISMISS_KEY = 'smd:promo-dismissed-at'

function matchesPlacement(offer: Offer, placement: OfferPlacement): boolean {
  return offer.placements.includes(placement) && offer.weight > 0
}

function targetsPlatform(offer: Offer, platform: string | undefined): boolean {
  if (offer.platforms === 'all') return false
  if (!platform) return false
  return offer.platforms.includes(platform)
}

/**
 * Platform-specific offers beat generic ones outright rather than merely
 * outweighing them: a matched offer converts several times better, and a
 * blended pool would dilute that away.
 */
function candidatesFor(
  offers: readonly Offer[],
  placement: OfferPlacement,
  platform: string | undefined,
): Offer[] {
  const eligible = offers.filter((o) => matchesPlacement(o, placement))
  const targeted = eligible.filter((o) => targetsPlatform(o, platform))
  if (targeted.length > 0) return targeted
  return eligible.filter((o) => o.platforms === 'all')
}

/**
 * Weighted pick, deterministic in `seed` so a re-render cannot swap the card
 * out from under a user mid-read (and so the tests are not flaky).
 */
export function selectOffer(
  offers: readonly Offer[],
  opts: { placement: OfferPlacement; platform?: string; seed: number },
): Offer | null {
  const pool = candidatesFor(offers, opts.placement, opts.platform)
  if (pool.length === 0) return null

  const total = pool.reduce((sum, o) => sum + o.weight, 0)
  if (total <= 0) return null

  let cursor = Math.abs(opts.seed) % total
  for (const candidate of pool) {
    cursor -= candidate.weight
    if (cursor < 0) return candidate
  }
  return pool[pool.length - 1]
}

/**
 * Attribution rides on the affiliate network's own sub-id parameter, read back
 * in their dashboard. Nothing is reported to us, which is what keeps the
 * privacy claim true.
 */
export function offerHref(
  offer: Offer,
  placement: OfferPlacement,
  platform?: string,
): string {
  const subid = `${placement}_${platform || 'none'}`

  // The fragment has to be split off before `subid` is inserted and
  // reattached last. Deciding the separator on `includes('?')` alone, without
  // this split, put `subid` after a `#` on a fragment URL — inside the
  // fragment, which is never sent to the server, so the click would never
  // show up in the affiliate dashboard. subid is the only attribution
  // mechanism this design has, so that failure is silent and total.
  const hashIndex = offer.href.indexOf('#')
  const base = hashIndex === -1 ? offer.href : offer.href.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : offer.href.slice(hashIndex)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}subid=${subid}${fragment}`
}

export function isPromoDismissed(now: number): boolean {
  try {
    const raw = window.localStorage.getItem(PROMO_DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return now - at < PROMO_DISMISS_MS
  } catch {
    // Storage blocked (private mode) — treat as not dismissed.
    return false
  }
}

export function dismissPromo(now: number): void {
  try {
    window.localStorage.setItem(PROMO_DISMISS_KEY, String(now))
  } catch {
    // Nothing to do; the slot simply reappears next session.
  }
}
