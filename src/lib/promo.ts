import type { Offer, OfferPlacement } from '@/config/offers'

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

/** The slot's two cards. A third would squeeze both on a phone. */
export const MAX_OFFERS = 2

/** Every offer the slot shows, heaviest first. A tie keeps catalogue order. */
export function selectOffers(
  offers: readonly Offer[],
  opts: { placement: OfferPlacement; platform?: string },
): Offer[] {
  return candidatesFor(offers, opts.placement, opts.platform)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_OFFERS)
}

/**
 * Attribution rides on the affiliate network's own sub-id parameter, read back
 * in their dashboard.
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
