import { installLink } from '@/lib/apps'

/**
 * The commercial catalogue. This file is the entire process for adding,
 * reweighting, or killing an offer — no component changes, no deploy-time
 * config.
 *
 * `platforms` drives intent matching: a user who just pulled a TikTok is a
 * different buyer from one who just pulled a Vimeo lecture. A platform-specific
 * offer always beats an 'all' offer for that platform (see selectOffers).
 *
 * `weight` ranks the matched set, and the slot shows the top two together. Set
 * it to 0 to bench an offer without deleting its config.
 *
 * Attribution is via the `subid` query parameter appended by offerHref(), read
 * back in each affiliate network's own dashboard. Shown and clicked counts per
 * offer are in PostHog, as `promo_shown` (mounted), `promo_seen` (half on
 * screen for a second) and `promo_click`.
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
  /** The tag beside the button. Defaults to 'Sponsored'; our own apps say so. */
  label?: string
  /** Our link, not an affiliate's: a clean URL, followed by crawlers. */
  ownApp?: boolean
  /**
   * ISO instant the placement ends, checked in the visitor's browser, so a
   * paid month stops on time with no deploy. Required on every live paid offer
   * (promo.test.ts). Leave the entry in place afterwards as the record.
   */
  until?: string
}

/**
 * Placeholder hrefs marked TEMPLATE must be replaced with the real affiliate
 * link before the offer is given a non-zero weight. Weight 0 keeps an
 * un-approved program out of rotation without deleting its copy.
 */
export const OFFERS: readonly Offer[] = [
  {
    id: 'masareef',
    headline: 'Know where your money went',
    body: 'Masareef is an offline-first, multi-currency spending tracker, from the people behind this site.',
    cta: 'Get Masareef',
    // The app's own short domain, tagged apart from the footer's "Our apps" link.
    href: installLink('masareef', 'socialdownloader-promo'),
    weight: 1,
    platforms: 'all',
    placements: ['post-result', 'in-content'],
    image: '/promo/masareef.png',
    label: 'Our app',
    ownApp: true,
  },
  {
    id: 'rafiq',
    headline: 'Prayer, Qur’an and adhkar in one place',
    body: 'Rafiq is a private companion for prayer, Qur’an, adhkar and qibla, from the people behind this site.',
    cta: 'Get Rafiq',
    href: installLink('rafiq', 'socialdownloader', 'promo'),
    weight: 1,
    platforms: 'all',
    placements: ['post-result', 'in-content'],
    image: '/promo/rafiq.png',
    label: 'Our app',
    ownApp: true,
  },
  {
    // Paid flat fee: $100 for one month, on every download (post-result only;
    // the in-content box's reserved height was measured for the apps' copy).
    // Copy and SMD15 are the sponsor's own, used verbatim as agreed. Live
    // 2026-11-13; ends itself 30 days later. Swap href for their custom
    // tracking link when it arrives; keep `until` as it is.
    // Weight 2 holds one card for them; the other stays Masareef.
    id: 'proxy-seller',
    headline: 'Proxies for any workflow, 15% off',
    body: 'Proxy-Seller gives you reliable proxy infrastructure for any workflow: private residential, mobile (4G/5G/LTE), ISP, and datacenter IPv4/IPv6 proxies, all with HTTP(S) and SOCKS5 support. Tap into 47M+ residential IPs across 220+ locations, target exactly the country, city, or ISP you need, and count on 99.7% uptime backed by 24/7 support. Get 15% off with promo code SMD15.',
    cta: 'Get 15% off',
    href: 'https://proxy-seller.com/',
    weight: 2,
    platforms: 'all',
    placements: ['post-result'],
    until: '2026-12-13T12:00:00Z',
  },
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
    // Redirects to pcloud.com/lifetime. 20% of a $199-399 lifetime plan, and
    // the subid survives the redirect chain through to landing.pcloud.com, so
    // placement attribution works off this one link.
    // Benched for our own apps, which hold both of the slot's cards. Set to 1 and
    // one of those to 0 to swap back.
    href: 'https://partner.pcloud.com/r/156822',
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
