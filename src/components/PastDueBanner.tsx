'use client'

/**
 * The single interruption this entire feature is allowed to put on the
 * downloader, and only for someone who is already paying.
 *
 * A subscriber in the grace window is still using Pro normally and has no
 * reason to open their account page before it runs out — so the one state that
 * ends in losing access has to find them, not wait to be found.
 */

import { PAST_DUE_GRACE_MS } from '@/lib/billing/entitlement'
import { useAccount } from '@/lib/account'

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

// Reading the clock is a side effect, and the React compiler flags a bare
// Date.now() inside a component body as impure-during-render. Module scope
// puts it out of that analysis without changing behaviour — see the same
// pattern in DownloaderApp.tsx.
function nowMs(): number {
  return Date.now()
}

export function PastDueBanner() {
  const { plan } = useAccount()
  if (plan?.status !== 'past_due' || plan.pastDueSince === null) return null

  const endsAt = plan.pastDueSince + PAST_DUE_GRACE_MS
  if (endsAt <= nowMs()) return null

  return (
    <div
      role='status'
      className='mx-auto mb-4 flex max-w-3xl flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between'
    >
      <p>
        We couldn&rsquo;t take payment. Pro stays on until {formatDate(endsAt)}.
      </p>
      <a
        href='/api/billing/portal'
        className='shrink-0 rounded-lg bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-50 transition-colors hover:bg-amber-400/30'
      >
        Update payment method
      </a>
    </div>
  )
}
