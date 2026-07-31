/**
 * The commercial catalogue. This file is the entire process for adding,
 * reweighting, or killing an offer — no component changes, no deploy-time
 * config.
 *
 * `platforms` drives intent matching: a user who just pulled a TikTok is a
 * different buyer from one who just pulled a Vimeo lecture. A platform-specific
 * offer always beats an 'all' offer for that platform (see selectOffer).
 *
 * `weight` is relative within the matched set. Set it to 0 to bench an offer
 * without deleting its config.
 *
 * Attribution is via the `subid` query parameter appended by offerHref(), read
 * back in each affiliate network's own dashboard. Cloudflare Web Analytics has
 * no custom-event API and we deliberately run no other tracking.
 */

export type OfferPlacement = 'post-result' | 'in-content'

export interface Offer {
  /** Stable id. Also used as the React key and in the subid. */
  id: string
  headline: string
  body: string
  cta: string
  /** The affiliate destination, including whatever ref/aff parameter the network issues. */
  href: string
  /** Relative weight within the matched set. 0 benches the offer. */
  weight: number
  /** Platform slugs from detectPlatform(), or 'all'. */
  platforms: readonly string[] | 'all'
  placements: readonly OfferPlacement[]
  /**
   * Optional local creative, e.g. '/promo/pcloud.png'. Must live under
   * /public — no remote host, no next/image (that's the "zero third-party
   * script" rule and the CLS budget both at once). PromoSlot renders it at a
   * fixed size so adding one later cannot shift layout. Omit to render a
   * text-only card, which is what every current entry does.
   */
  image?: string
}

/**
 * Placeholder hrefs marked TEMPLATE must be replaced with the real affiliate
 * link before the offer is given a non-zero weight. Weight 0 keeps an
 * un-approved program out of rotation without deleting its copy.
 */
export const OFFERS: readonly Offer[] = [
  {
    id: 'hitpaw-converter',
    headline: 'Convert and edit what you just saved',
    body: 'HitPaw Video Converter handles 1000+ formats, batch conversion, and quick edits on desktop.',
    cta: 'See HitPaw',
    href: 'TEMPLATE_HITPAW',
    weight: 0,
    platforms: ['tiktok', 'youtube', 'instagram', 'facebook', 'twitter'],
    placements: ['post-result', 'in-content'],
  },
  {
    id: 'pcloud-lifetime',
    headline: 'Somewhere to keep them',
    body: 'pCloud lifetime storage — pay once, keep your library off a phone that fills up.',
    cta: 'See pCloud',
    href: 'TEMPLATE_PCLOUD',
    weight: 0,
    platforms: 'all',
    placements: ['post-result', 'in-content'],
  },
  {
    id: 'epidemic-sound',
    headline: 'Music you can actually post with',
    body: 'Epidemic Sound licenses every track for social — no copyright strikes on your own uploads.',
    cta: 'See Epidemic Sound',
    href: 'TEMPLATE_EPIDEMIC',
    weight: 0,
    platforms: ['tiktok', 'instagram', 'threads', 'snapchat'],
    placements: ['post-result'],
  },
  {
    id: 'nordvpn',
    headline: 'Blocked where you are?',
    body: 'NordVPN unblocks region-locked video and keeps your connection private.',
    cta: 'See NordVPN',
    href: 'TEMPLATE_NORDVPN',
    weight: 0,
    platforms: 'all',
    placements: ['in-content'],
  },
]
