'use client'

import Link from 'next/link'
import { Surface } from '@/components/Surface'
import { hasAccountHint, signInHref, useAccount } from '@/lib/account'
import { useHydrated } from '@/lib/clientEnv'
import {
  isProCheckoutConfigured,
  PRO_CHECKOUT_ANNUAL,
  PRO_CHECKOUT_MONTHLY,
} from '@/config/pro'

/**
 * Both variants share one deployment condition — either both are live Creem
 * payment links or neither is, since they come from the same store — so one
 * flag gates the copy rather than two independent ones.
 */
const CHECKOUT_READY =
  isProCheckoutConfigured(PRO_CHECKOUT_ANNUAL) && isProCheckoutConfigured(PRO_CHECKOUT_MONTHLY)

type CtaState = 'signed-out' | 'signed-in'

/**
 * A pending store changes what this panel *says*, never whether it does
 * anything.
 *
 * It used to render a disabled "Checkout coming soon" button, which turned the
 * one page a payment provider actually opens during review into the
 * coming-soon shell their own checklist rejects — and it dead-ended the
 * visitor too, since signing in is a real, working step whether or not card
 * payments are switched on yet. Both states now start the same flow; only the
 * lede admits where the store is.
 */
const PENDING_LEDE =
  'Card payments switch on as soon as our payment provider finishes verifying the store. Create your account now and Pro is one click when they do.'

const CTA_COPY: Record<CtaState, string> = {
  'signed-out': 'One Google sign-in, no password, no card typed on this page.',
  'signed-in': 'Pick monthly or annual, and manage it any time, from your account.',
}

/**
 * The only interactive part of /pro. Everything else on the page is static
 * marketing copy.
 *
 * Checkout requires signing in first, so this never links to Creem directly:
 * a signed-out visitor is sent to Google sign-in, and a signed-in one is sent
 * to /account, the one place that knows the user's id and can build the
 * checkout link for the plan they pick.
 */
export function ProCtaPanel() {
  const { signedIn } = useAccount()
  const hydrated = useHydrated()
  // The hint cookie answers this with no request, so a signed-in visitor is
  // never shown the sign-in CTA first and then swapped to "Continue to your
  // account" under their cursor. Gated on `hydrated` because the prerendered
  // markup cannot know, and that gate settles before the first paint.
  const here = hydrated ? (signedIn ?? hasAccountHint()) : signedIn
  const state: CtaState = here ? 'signed-in' : 'signed-out'

  return (
    <Surface elevation='raised' className='flex flex-col items-center gap-3 p-5 text-center sm:p-6'>
      <p className='text-sm text-white/60'>{CHECKOUT_READY ? CTA_COPY[state] : PENDING_LEDE}</p>

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
