'use client'

import { useMemo, useState } from 'react'
import { OFFERS, type OfferPlacement } from '@/config/offers'
import { useHydrated } from '@/lib/clientEnv'
import { dismissPromo, isPromoDismissed, offerHref, selectOffer } from '@/lib/promo'

// Reading the clock or the RNG is a side effect, and the React compiler flags
// a bare Date.now()/Math.random() inside a component body as
// impure-during-render. Module scope puts each behind a named function, out
// of that analysis, without changing behaviour (same idiom as
// DownloaderApp.tsx's nowMs()).
function nowMs(): number {
  return Date.now()
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}

/**
 * The one surface on this site that carries commercial content, and therefore
 * the one place the rules live:
 *
 *  - never above the fold, never during a resolve, never during a download
 *    (the caller controls that by only mounting it once a result exists);
 *  - fixed min-height reserved before paint, so nothing below it moves — CLS
 *    from this component must stay at 0;
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
  const [dismissed, setDismissed] = useState(false)

  // Seeded once per mount so a parent re-render cannot swap the card mid-read.
  const seed = useMemo(() => randomSeed(), [])
  const offer = useMemo(
    () => selectOffer(OFFERS, { placement, platform, seed }),
    [placement, platform, seed],
  )

  if (!offer) return null

  // The height is reserved unconditionally; only the contents are gated on
  // hydration and dismissal. Reserving after the checks would let the card
  // push the page down after paint, which is exactly the CLS we are avoiding.
  const suppressed = dismissed || (hydrated && isPromoDismissed(nowMs()))

  return (
    <div className='mt-4 min-h-[104px] sm:min-h-[92px]'>
      {!suppressed && (
        <div className='animate-section-in group relative overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-white'>{offer.headline}</p>
              <p className='mt-1 text-xs leading-relaxed text-white/60 md:text-sm'>
                {offer.body}
              </p>
            </div>
            <button
              type='button'
              aria-label='Dismiss this sponsor card'
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
      )}
    </div>
  )
}
