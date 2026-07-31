'use client'

import { useId, useMemo, useState } from 'react'
import { OFFERS, type OfferPlacement } from '@/config/offers'
import { useHydrated } from '@/lib/clientEnv'
import { useTier } from '@/lib/entitlements'
import { dismissPromo, isPromoDismissed, offerHref, selectOffer } from '@/lib/promo'

// Reading the clock is a side effect, and the React compiler flags a bare
// Date.now() inside a component body as impure-during-render. Module scope
// puts it behind a named function, out of that analysis, without changing
// behaviour (same idiom as DownloaderApp.tsx's nowMs()).
function nowMs(): number {
  return Date.now()
}

/**
 * djb2, truncated to a positive 31-bit int. Cheap, deterministic, and — the
 * only property that matters here — a pure function of its input, so it
 * produces the same seed on the server-rendered HTML and on the client during
 * hydration as long as `id` is the same string on both.
 */
function hashToSeed(id: string): number {
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33 + id.charCodeAt(i)) | 0
  }
  return hash & 0x7fffffff
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
 * The one surface on this site that carries commercial content, and therefore
 * the one place the rules live:
 *
 *  - never above the fold, never during a resolve, never during a download
 *    (the caller controls that by only mounting it once a result exists);
 *  - content never appears and then vanishes — see `showContent` below;
 *  - dismissible, and a dismissal sticks for a week;
 *  - no third-party script. This is a local <a> with rel="sponsored".
 *
 * Task 11 adds the Pro check here; every call site stays as-is.
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
  const [dismissed, setDismissed] = useState(false)

  // useId() returns the same string during the static (server) render and
  // during client hydration, so hashing it into the seed guarantees the same
  // offer is chosen both times. A random seed here would let selectOffer land
  // on a different candidate the instant two offers share a pool — a content
  // swap right after hydration, and a hydration-mismatch warning to go with
  // it. Also stable across a parent re-render, same as the seed it replaces.
  const reactId = useId()
  const seed = useMemo(() => hashToSeed(reactId), [reactId])
  const offer = useMemo(
    () => selectOffer(OFFERS, { placement, platform, seed }),
    [placement, platform, seed],
  )

  if (!offer) return null

  const suppressed =
    tier === 'pro' || dismissed || (hydrated && isPromoDismissed(nowMs()))

  // Content only ever renders once `hydrated` is true, i.e. once the client
  // has actually resolved tier and dismissal from real localStorage — not the
  // always-'free'/always-not-dismissed values a server (or a hydrating
  // client) is forced to assume. On `in-content`, which is present in the
  // static HTML, that means a Pro or previously-dismissed visitor never sees
  // the card at all — it never paints in the first place, let alone
  // vanishes a beat later. The tradeoff is that a free, never-dismissed
  // visitor sees the card appear slightly after paint instead of pre-painted,
  // which is the correct price for "nobody who shouldn't see it, ever does."
  const showContent = hydrated && !suppressed

  const cardContent = showContent && (
    <div className='animate-section-in group relative overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          {offer.image && (
            <img
              src={offer.image}
              alt={offer.headline}
              width={40}
              height={40}
              className='h-10 w-10 shrink-0 rounded-lg object-cover'
            />
          )}
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-white'>{offer.headline}</p>
            <p className='mt-1 text-xs leading-relaxed text-white/60 md:text-sm'>
              {offer.body}
            </p>
          </div>
        </div>
        <button
          type='button'
          aria-label='Hide this sponsor card'
          onClick={() => {
            dismissPromo(nowMs())
            setDismissed(true)
          }}
          className='shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:text-white/80'
        >
          Hide
        </button>
      </div>

      <div className='mt-3 flex items-center justify-between gap-3'>
        <a
          href={offerHref(offer, placement, platform)}
          target='_blank'
          rel='sponsored nofollow noopener noreferrer'
          className='rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition-transform duration-200 hover:-translate-y-0.5 hover:text-white active:scale-95'
        >
          {offer.cta}
        </a>
        <span className='text-[11px] text-white/35'>Sponsored</span>
      </div>
    </div>
  )

  // `in-content` reserves its box unconditionally — the height must be held
  // through the pre-hydration window and stay held after, even while
  // suppressed, so the SEO/FAQ section below it never shifts.
  if (reservesHeight(placement)) {
    return <div className='mt-4 min-h-[104px] sm:min-h-[92px]'>{cardContent}</div>
  }

  // `post-result` reserves nothing: with no in-flow content of its own after
  // it, an empty box would just be a permanent gap for a Pro/dismissed user.
  if (!showContent) return null
  return <div className='mt-4'>{cardContent}</div>
}
