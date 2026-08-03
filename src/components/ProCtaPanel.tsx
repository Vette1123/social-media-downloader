'use client'

import Link from 'next/link'
import { Surface } from '@/components/Surface'
import { signInHref, useAccount } from '@/lib/account'
import {
  isProCheckoutConfigured,
  PRO_CHECKOUT_ANNUAL,
  PRO_CHECKOUT_MONTHLY,
} from '@/config/pro'

/**
 * Both variants share one deployment condition — either both are live Lemon
 * Squeezy URLs or neither is, since they come from the same pending store —
 * so one flag gates the whole panel rather than two independent ones.
 */
const CHECKOUT_READY =
  isProCheckoutConfigured(PRO_CHECKOUT_ANNUAL) && isProCheckoutConfigured(PRO_CHECKOUT_MONTHLY)

type CtaState = 'unavailable' | 'signed-out' | 'signed-in'

function ctaState(signedIn: boolean | undefined): CtaState {
  if (!CHECKOUT_READY) return 'unavailable'
  return signedIn ? 'signed-in' : 'signed-out'
}

const CTA_COPY: Record<CtaState, { lede: string }> = {
  unavailable: { lede: 'The store is being set up — checkout is not live yet.' },
  'signed-out': {
    lede: 'One Google sign-in, no password, no card typed on this page.',
  },
  'signed-in': { lede: 'Pick monthly or annual, and manage it any time, from your account.' },
}

/**
 * The only interactive part of /pro. Everything else on the page is static
 * marketing copy.
 *
 * Checkout requires signing in first, so this never links to Lemon Squeezy
 * directly: a signed-out visitor is sent to Google sign-in, and a signed-in
 * one is sent to /account, the one place that knows the user's email and can
 * build the checkout link for the plan they pick.
 */
export function ProCtaPanel() {
  const { signedIn } = useAccount()
  const state = ctaState(signedIn)

  return (
    <Surface elevation='raised' className='flex flex-col items-center gap-3 p-5 text-center sm:p-6'>
      <p className='text-sm text-white/60'>{CTA_COPY[state].lede}</p>

      {state === 'unavailable' && (
        <button
          type='button'
          disabled
          title='Checkout is not set up yet'
          className='inline-flex cursor-not-allowed rounded-xl bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white/40 ring-1 ring-white/10'
        >
          Checkout coming soon
        </button>
      )}

      {state === 'signed-out' && (
        <a
          // Straight to /account, not back to /pro. Signing in here is a step
          // in buying, and /account is where the plan is picked — a signed-in
          // visitor returned to this panel would only be told to go there.
          href={signInHref('/account')}
          className='btn-grad inline-flex rounded-xl px-6 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
        >
          Sign in with Google to get Pro
        </a>
      )}

      {state === 'signed-in' && (
        <Link
          href='/account'
          className='btn-grad inline-flex rounded-xl px-6 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
        >
          Continue to your account
        </Link>
      )}
    </Surface>
  )
}
