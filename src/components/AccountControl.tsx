'use client'

/**
 * The site's only account affordance: a small control pinned to the top-right
 * of every page.
 *
 * Deliberately not a header bar. This site has never had one — every page is a
 * standalone layout tuned to a 96 mobile Lighthouse score — and introducing one
 * to hold a single link would be a far larger visual change than the feature
 * warrants.
 *
 * It renders from the `smd_account` hint cookie, read synchronously with no
 * network call, because a page view must keep invoking no Worker at all. The
 * slot is fixed-size and renders empty until hydration, so there is no "Sign in"
 * flash for a signed-in visitor and no layout shift for anyone.
 */

import Link from 'next/link'
import { hasAccountHint, signInHref } from '@/lib/account'
import { useHydrated } from '@/lib/clientEnv'

export function AccountControl() {
  const hydrated = useHydrated()
  const signedIn = hydrated && hasAccountHint()

  return (
    <div className='pointer-events-none fixed top-3 right-3 z-50 flex h-9 items-center justify-end sm:top-4 sm:right-4'>
      {hydrated && (
        <Link
          href={signedIn ? '/account' : signInHref()}
          className='pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs font-medium text-white/60 backdrop-blur transition-colors hover:border-white/20 hover:text-white'
        >
          {signedIn ? 'Account' : 'Sign in'}
        </Link>
      )}
    </div>
  )
}
