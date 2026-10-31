'use client'

import { trackFeatureUsed } from '@/lib/analytics'
import { useEffect, useId, useMemo } from 'react'
import { Surface } from '@/components/Surface'
import { OFFERS, type OfferPlacement } from '@/config/offers'
import { useHydrated } from '@/lib/clientEnv'
import { useTier } from '@/lib/entitlements'
import type { TKey } from '@/lib/i18n'
import { useLocale, useT } from '@/lib/i18nStore'
import { hashToSeed, offerHref, selectOffer } from '@/lib/promo'

/** Our own apps are translated: a sponsor's words are the sponsor's. */
const OWN_APP_COPY: Record<string, { headline: TKey; body: TKey; cta: TKey }> = {
  masareef: {
    headline: 'offerMasareefHeadline',
    body: 'offerMasareefBody',
    cta: 'offerMasareefCta',
  },
  rafiq: {
    headline: 'offerRafiqHeadline',
    body: 'offerRafiqBody',
    cta: 'offerRafiqCta',
  },
}

/**
 * `in-content` (PlatformLanding) always has real flow content after it — the
 * SEO prose/FAQ section — so its height must stay reserved no matter what,
 * or that content shifts up the instant hydration resolves tier/dismissal.
 * `post-result` (DownloaderApp) has nothing after it in its own returned tree
 * — the image lightbox that can follow it in JSX portals to <body> with
 * `position: fixed`, so it never occupies layout there — which means
 * reserving height for it buys no CLS protection and would instead leave a
 * Pro or previously-dismissed visitor staring at a permanent empty box on
 * every completed download.
 */
function reservesHeight(placement: OfferPlacement): boolean {
  return placement === 'in-content'
}

/**
 * Scaffold for third-party display-ad integration. Structure only; no network
 * script. When a network is integrated, this container receives the ad unit
 * markup or script injection point. Both this and the offer card are wrapped
 * in the same dismissible shell, so the dismiss affordance applies to either
 * branch identically.
 *
 * Note: NEXT_PUBLIC_ADS_ENABLED is a runtime off-switch, not a compile-time
 * optimization. Both branches ship in the static bundle; Turbopack does not
 * eliminate unused branches in 'use client' components during static export.
 * The false branch executes when the flag is unset (the default).
 */
function AdUnit() {
  return (
    <div>
      {/* Display ad unit will be rendered here when enabled */}
    </div>
  )
}

/**
 * The one surface on this site that carries commercial content, and therefore
 * the one place the rules live:
 *
 *  - never above the fold, never during a resolve, never during a download
 *    (the caller controls that by only mounting it once a result exists);
 *  - content never appears and then vanishes — see `showContent` below;
 *  - no third-party script. This is a local <a> with rel="sponsored", or a
 *    display-ad scaffold when NEXT_PUBLIC_ADS_ENABLED === '1'.
 *
 * Not dismissible. The slot is one static card, below the result, with no
 * script and no motion — the annoyance a hide button answers isn't present,
 * and the button traded away the revenue this site runs on. Buying it off is
 * what /pro is for. Paying visitors are suppressed by tier, not by a flag in
 * localStorage.
 */
export function PromoSlot({
  placement,
  platform,
}: {
  placement: OfferPlacement
  platform?: string
}) {
  const hydrated = useHydrated()
  const tier = useTier()
  const t = useT()
  const locale = useLocale()

  // useId() returns the same string during the static (server) render and
  // during client hydration, so hashing it into the seed guarantees the same
  // offer is chosen both times. A random seed here would let selectOffer land
  // on a different candidate the instant two offers share a pool — a content
  // swap right after hydration, and a hydration-mismatch warning to go with
  // it. Also stable across a parent re-render, same as the seed it replaces.
  // The platform is what shares the slot between offers: useId alone never
  // changes, so one of two equal offers would simply never show.
  const reactId = useId()
  const seed = useMemo(
    () => hashToSeed(`${reactId}:${placement}:${platform ?? ''}`),
    [reactId, placement, platform],
  )
  const offer = useMemo(
    () => selectOffer(OFFERS, { placement, platform, seed }),
    [placement, platform, seed],
  )
  const copy = locale !== 'en' && offer ? OWN_APP_COPY[offer.id] : undefined

  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === '1'
  const shownOffer = hydrated && tier !== 'pro' ? offer?.id : undefined

  useEffect(() => {
    if (shownOffer) trackFeatureUsed('promo_shown', { action: shownOffer, outcome: placement })
  }, [shownOffer, placement])

  // When ads are disabled, an offer is required to render anything. When ads
  // are enabled, the slot renders on its own terms without a live offer.
  if (!offer && !adsEnabled) return null

  // Content only ever renders once `hydrated` is true, i.e. once the client
  // has actually resolved the tier from real localStorage — not the
  // always-'free' value a server (or a hydrating client) is forced to assume.
  // On `in-content`, which is present in the static HTML, that means a Pro
  // visitor never sees the card at all — it never paints in the first place,
  // let alone vanishes a beat later. The tradeoff is that a free visitor sees
  // the card appear slightly after paint instead of pre-painted, which is the
  // correct price for "nobody who shouldn't see it, ever does."
  const showContent = hydrated && tier !== 'pro'

  const cardContent = showContent && (
    <Surface className='animate-section-in group flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-center sm:justify-between'>
      {adsEnabled ? (
        <AdUnit />
      ) : (
        offer && (
          <div className='flex min-w-0 items-start gap-3'>
            {offer.image && (
              <img
                src={offer.image}
                alt={offer.headline}
                width={48}
                height={48}
                className='h-12 w-12 shrink-0 rounded-xl object-cover'
              />
            )}
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-white'>
                {copy ? t(copy.headline) : offer.headline}
              </p>
              <p className='mt-1 text-xs leading-relaxed text-white/60 md:text-sm'>
                {copy ? t(copy.body) : offer.body}
              </p>
            </div>
          </div>
        )
      )}

      {!adsEnabled && offer && (
        <div className='flex shrink-0 items-center justify-between gap-3 sm:flex-row-reverse'>
          <Surface
            as='a'
            href={offerHref(offer, placement, platform)}
            onClick={() => trackFeatureUsed('promo_click', { action: offer.id, outcome: placement })}
            target='_blank'
            rel='sponsored nofollow noopener noreferrer'
            elevation='raised'
            interaction='lift'
            radius='xl'
            className='whitespace-nowrap px-3 py-2 text-sm font-medium text-white/80 hover:text-white'
          >
            {copy ? t(copy.cta) : offer.cta}
          </Surface>
          <span className='text-[11px] text-white/50'>{copy ? t('offerMasareefLabel') : (offer.label ?? 'Sponsored')}</span>
        </div>
      )}
    </Surface>
  )

  // `in-content` reserves its box unconditionally — the height must be held
  // through the pre-hydration window and stay held after, even while
  // suppressed, so the SEO/FAQ section below it never shifts.
  if (reservesHeight(placement)) {
    return <div className='mt-4 min-h-[188px] sm:min-h-[98px]'>{cardContent}</div>
  }

  // `post-result` reserves nothing: with no in-flow content of its own after
  // it, an empty box would just be a permanent gap for a Pro/dismissed user.
  if (!showContent) return null
  return <div className='mt-4'>{cardContent}</div>
}
