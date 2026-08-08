'use client'

import { useState } from 'react'
import { Surface } from '@/components/Surface'
import { CheckIcon } from '@/components/icons'
import {
  PRO_CHECKOUT_ANNUAL,
  PRO_CHECKOUT_MONTHLY,
  PRO_PRICE_ANNUAL,
  PRO_PRICE_MONTHLY,
  type ProVariant,
  isProCheckoutConfigured,
} from '@/config/pro'
import { hasAccountHint, signInHref, useAccount } from '@/lib/account'
import { useHydrated } from '@/lib/clientEnv'

/**
 * Pick a plan, then buy it — the one buying control on the site.
 *
 * It replaced two separate things that had drifted apart: a pair of static
 * price cards on /pro with no button under them at all, and a second pair on
 * the account page that were buttons but never showed which plan you were
 * choosing. Two shapes for one decision is how a checkout starts feeling
 * assembled, and only one of them could actually be bought from.
 *
 * The important part is what a signed-out visitor gets. /pro used to send them
 * to Google and land them on their account, where they had to find the plan
 * again and pick it a second time — the pick was thrown away at the door. Now
 * the checkout route *is* the sign-in redirect target, so signing in continues
 * straight into Creem with the plan they chose. `safeRedirect` keeps that to a
 * path on our own origin, so this cannot be turned into an open redirect.
 *
 * Checkout itself is always our own Worker route, never a Creem link built
 * here: the route picks the store from the API key it actually holds, so a test
 * deployment cannot charge a real card. See src/lib/billing/checkout.ts.
 */

/**
 * Both variants come from one Creem store, so either both links are live or
 * neither is. A pending store changes what this panel *says* and never whether
 * it does anything: signing in is a real, working step regardless, and a
 * disabled "coming soon" button is what a payment provider's own review
 * checklist rejects.
 */
const CHECKOUT_READY =
  isProCheckoutConfigured(PRO_CHECKOUT_ANNUAL) && isProCheckoutConfigured(PRO_CHECKOUT_MONTHLY)

const PENDING_NOTE =
  'Card payments switch on as soon as our payment provider finishes verifying the store. Create your account now and Pro is one click when they do.'

interface PlanOption {
  variant: ProVariant
  price: string
  period: string
  /** What the same year costs on the other plan. Struck through beside the
   *  price, so the saving is shown rather than asserted. */
  compare?: string
  /** The reason to pick this one, in a few words. */
  aside: string
  ribbon?: string
}

const OPTIONS: readonly PlanOption[] = [
  {
    variant: 'annual',
    price: PRO_PRICE_ANNUAL,
    period: '/year',
    // Twelve months at the monthly price. Both numbers come from config, so a
    // price change cannot leave a stale comparison on the page.
    compare: `$${12 * Number(PRO_PRICE_MONTHLY.replace('$', ''))}`,
    aside: 'Two months free · $2 a month, billed yearly',
    ribbon: 'Best value',
  },
  {
    variant: 'monthly',
    price: PRO_PRICE_MONTHLY,
    period: '/month',
    aside: 'Cancel any time',
  },
]

/** Annual first, and selected by default — see the note in config/pro.ts. */
const DEFAULT_VARIANT: ProVariant = 'annual'

/** The chosen plan, priced, for the button that buys it. */
function buyLabel(variant: ProVariant): string {
  const option = OPTIONS.find((o) => o.variant === variant)
  return `Get Pro — ${option?.price}${option?.period}`
}

/**
 * What the small print says depends on where the visitor is in the flow, and
 * one of the three states is a deployment condition rather than a user one —
 * which is exactly the shape that turns into nested ternaries in JSX.
 */
function footnote(signedIn: boolean): string {
  if (!CHECKOUT_READY) return PENDING_NOTE
  if (!signedIn) return 'One sign-in, then checkout. No password, no card typed on this page.'
  return 'Cancel any time from your account. Card details never touch this site.'
}

function PlanOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: PlanOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    // Tone carries the selection, not a ring stacked on top of the border:
    // `accent` mixes cyan into the panel fill and lifts the border with it, the
    // same language every other accented card on the site uses. A ring would
    // have drawn a second edge a pixel outside the first.
    <Surface
      as='button'
      tone={selected ? 'accent' : 'neutral'}
      elevation={selected ? 'base' : 'raised'}
      interaction='hover'
      // A radio, not a button that navigates: nothing is bought by touching
      // this, and it belongs to the same exclusive group as the other card.
      role='radio'
      aria-checked={selected}
      type='button'
      onClick={onSelect}
      className={`relative w-full p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
        selected ? '[--surface-line:rgba(34,211,238,0.6)]' : ''
      }`}
    >
      {option.ribbon && (
        <span className='btn-grad absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
          {option.ribbon}
        </span>
      )}

      {/* The tick is the only thing that moves between states, so the two cards
          never change size as the choice moves between them. */}
      <span
        aria-hidden
        className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
          selected ? 'bg-cyan-400 text-[#04171b]' : 'ring-1 ring-white/15'
        }`}
      >
        {selected && <CheckIcon className='h-3 w-3' />}
      </span>

      <p className='mt-2 flex items-baseline justify-center gap-2'>
        {option.compare && (
          <s className='text-lg font-semibold text-white/30 decoration-white/40'>
            {option.compare}
          </s>
        )}
        <span className='text-3xl font-extrabold text-white tabular-nums'>
          {option.price}
          <span className='text-base font-medium text-white/50'>{option.period}</span>
        </span>
      </p>
      <p className='mt-1 text-xs text-white/50'>{option.aside}</p>
    </Surface>
  )
}

export function PlanChooser({ className = '' }: { className?: string }) {
  const [variant, setVariant] = useState<ProVariant>(DEFAULT_VARIANT)
  const { signedIn } = useAccount()
  const hydrated = useHydrated()

  // The hint cookie answers this with no request, so a signed-in visitor never
  // sees "Sign in to continue" swap to "Get Pro" under their cursor. Gated on
  // `hydrated` because the prerender cannot know, and that gate settles before
  // the first paint.
  const here = hydrated ? (signedIn ?? hasAccountHint()) : signedIn
  const checkout = `/api/billing/checkout?variant=${variant}`
  // Plain anchors throughout: both destinations are Worker routes that do not
  // exist in the static export, and next/link treats them as missing pages and
  // swallows the navigation.
  const href = here ? checkout : signInHref(checkout)

  return (
    <div className={className}>
      <div
        role='radiogroup'
        aria-label='Choose a plan'
        className='grid gap-3 pt-3 sm:grid-cols-2'
      >
        {OPTIONS.map((option) => (
          <PlanOptionCard
            key={option.variant}
            option={option}
            selected={variant === option.variant}
            onSelect={() => setVariant(option.variant)}
          />
        ))}
      </div>

      <a
        href={href}
        className='btn-grad btn-press mt-4 flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-semibold sm:text-base'
      >
        {here ? buyLabel(variant) : 'Continue with Google'}
      </a>

      <p className='mt-3 text-center text-xs text-white/50'>{footnote(Boolean(here))}</p>
    </div>
  )
}
