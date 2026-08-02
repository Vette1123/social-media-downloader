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
 * Signed out it is the site's primary gradient button, because it is the only
 * call to action on an otherwise anonymous page. Signed in it is a quiet dark
 * pill carrying the visitor's own Google avatar, because at that point it is
 * navigation and should not compete with the downloader.
 *
 * Both halves paint with no network request. `smd_account` says *whether*
 * someone is signed in, and the localStorage profile cache says *who* — so a
 * page view still invokes no Worker at all, which is the constraint the whole
 * accounts design is built around. The slot is fixed-size and renders empty
 * until hydration, so there is no "Sign in" flash for a signed-in visitor and
 * no layout shift for anyone.
 */

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import {
  type CachedProfile,
  cachedProfile,
  hasAccountHint,
  signInHref,
  useAccount,
} from '@/lib/account'
import { useHydrated } from '@/lib/clientEnv'

/** First name, or the local part of the address. Never the whole email: this
 *  sits over page content at 12px and a long address would push the pill wide
 *  enough to cover the layout underneath it. */
function shortLabel(profile: CachedProfile | null): string {
  const name = profile?.name?.trim()
  if (name) return name.split(/\s+/)[0]
  const email = profile?.email ?? ''
  const local = email.split('@')[0]
  return local || 'Account'
}

export function AccountControl() {
  const hydrated = useHydrated()
  const live = useAccount()
  // Read once, synchronously, on the first client render. The store itself is
  // not seeded from this: only the server may decide what an account *is*, and
  // this is a paint hint for the corner of the screen.
  const [cached] = useState(cachedProfile)

  return (
    // `.account-slot` carries the top/right offsets, because they are notch-
    // aware and paired with the clearance `.app-bg` reserves for this control.
    // Taller on phones so the tap target is a thumb rather than a cursor.
    <div className='account-slot pointer-events-none fixed z-50 flex h-10 items-center justify-end sm:h-9'>
      {hydrated && <Control live={live} cached={cached} />}
    </div>
  )
}

function Control({
  live,
  cached,
}: {
  live: ReturnType<typeof useAccount>
  cached: CachedProfile | null
}) {
  // A settled `signedIn` always wins; the hint cookie answers for the common
  // case where nothing on this page has called the Worker at all.
  const signedIn = live.signedIn ?? hasAccountHint()

  if (!signedIn) {
    return (
      // A plain anchor, not next/link. `/api/auth/google` is a Worker route
      // that does not exist in the static export, so the client router treats
      // it as a missing page and swallows the navigation instead of letting
      // the browser follow the redirect to Google.
      <a
        href={signInHref()}
        className='btn-grad btn-press pointer-events-auto rounded-full px-4 py-2 text-xs font-semibold sm:py-1.5'
      >
        Sign in
      </a>
    )
  }

  const profile: CachedProfile | null = live.signedIn
    ? { email: live.email, name: live.name, picture: live.picture, pro: live.pro }
    : cached

  return (
    <Link
      href='/account'
      title={profile?.email ?? 'Your account'}
      aria-label={profile?.email ? `Account: ${profile.email}` : 'Your account'}
      className='btn-press pointer-events-auto group flex items-center gap-2 rounded-full border border-white/10 bg-black/50 p-1.5 backdrop-blur hover:border-white/25 sm:p-1 sm:pl-3'
    >
      <span className='hidden max-w-[8rem] truncate text-xs font-medium text-white/70 transition-colors group-hover:text-white sm:block'>
        {shortLabel(profile)}
      </span>
      {profile?.pro && (
        <span className='grad-fill hidden rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide uppercase sm:block'>
          Pro
        </span>
      )}
      {/* The ring is the only thing marking Pro on small screens, where the
          label and the chip are both hidden. */}
      <span
        className={`flex rounded-full p-[1.5px] ${profile?.pro ? 'grad-fill' : 'bg-white/15'}`}
      >
        <Avatar identity={profile} size={28} />
      </span>
    </Link>
  )
}
