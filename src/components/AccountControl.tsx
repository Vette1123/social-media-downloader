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
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { PinIcon, PinOffIcon } from '@/components/icons'
import {
  type CachedProfile,
  cachedProfile,
  hasAccountHint,
  signInHref,
  useAccount,
} from '@/lib/account'
import { useHydrated, useOnPageVisible } from '@/lib/clientEnv'

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

const PIN_KEY = 'smd_pin_account'
/** Below this the control overlaps content; above it there is room to spare. */
const PHONE = '(max-width: 39.99rem)'
/** Ignore the jitter of a finger resting on a scrolling page. */
const SCROLL_THRESHOLD = 8
/** Never hide it while the top of the page is still in view. */
const SCROLL_FLOOR = 80

function readPinned(): boolean {
  try {
    return window.localStorage.getItem(PIN_KEY) === '1'
  } catch {
    return false
  }
}

function writePinned(pinned: boolean): void {
  try {
    if (pinned) window.localStorage.setItem(PIN_KEY, '1')
    else window.localStorage.removeItem(PIN_KEY)
  } catch {
    // Private mode. The choice lasts for this page view instead of for the
    // device, which is the only thing lost.
  }
}

/**
 * Take the control away on the way down the page and bring it back on the way
 * up, so it is reachable without sitting on top of what someone is reading.
 *
 * The class is written straight to the node through a ref. This is the reason
 * a scroll here costs nothing: React never re-renders, so the work per frame
 * is one `classList.toggle` behind a rAF gate, on a listener that is passive
 * and only attached on the viewports that need it. Storing the position in
 * state instead would re-render the tree on every frame of every scroll, on
 * every page of the site, which is what the ban on scroll handlers is about.
 */
function usePeekOnScroll(ref: React.RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const node = ref.current
    if (!node) return

    node.classList.remove('account-slot--away')
    if (!enabled || !window.matchMedia(PHONE).matches) return

    let previous = window.scrollY
    let frame = 0

    const update = (): void => {
      frame = 0
      const y = window.scrollY
      const delta = y - previous
      if (Math.abs(delta) < SCROLL_THRESHOLD) return
      previous = y
      node.classList.toggle('account-slot--away', delta > 0 && y > SCROLL_FLOOR)
    }

    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
      node.classList.remove('account-slot--away')
    }
  }, [ref, enabled])
}

export function AccountControl() {
  const hydrated = useHydrated()
  const live = useAccount()
  // Not `window.location.pathname`: this component lives in the root layout, so
  // it survives client-side navigation and a value read once at mount would go
  // stale the moment someone moved between pages.
  const pathname = usePathname()
  // Read once, synchronously, on the first client render. The store itself is
  // not seeded from this: only the server may decide what an account *is*, and
  // this is a paint hint for the corner of the screen.
  const [cached, setCached] = useState(cachedProfile)
  // Safe as a lazy initialiser despite reading localStorage: this runs on the
  // server too (where it catches and returns false), and nothing below renders
  // until `hydrated`, so the value cannot reach the markup React compares.
  const [pinned, setPinned] = useState(readPinned)
  const slot = useRef<HTMLDivElement>(null)

  // Costs no request. Sign-in may have happened in another tab — or, on
  // Android, in the installed app, which shares this browser's cookie jar and
  // localStorage — and both of the things this control paints from are written
  // there. Re-reading them on the way back is the difference between a stale
  // "Sign in" button and the visitor's own avatar.
  useOnPageVisible(() => setCached(cachedProfile()))

  usePeekOnScroll(slot, !pinned)

  function togglePinned(): void {
    // The write stays out of the updater: React may call an updater twice, and
    // a side effect inside one runs twice with it.
    const next = !pinned
    setPinned(next)
    writePinned(next)
  }

  return (
    // `.account-slot` carries the top/right offsets, because they are notch-
    // aware and paired with the clearance `.app-bg` reserves for this control.
    // Taller on phones so the tap target is a thumb rather than a cursor.
    <div
      ref={slot}
      className='account-slot pointer-events-none fixed z-50 flex h-10 items-center justify-end gap-1.5 sm:h-9'
    >
      {hydrated && (
        <>
          {/* Left of the account pill, and only for people who have an account
              to get back to. An anonymous visitor gets the auto-hide and a
              single button, rather than a preference about a button. */}
          {(live.signedIn ?? hasAccountHint()) && (
            <PinToggle pinned={pinned} onToggle={togglePinned} />
          )}
          <Control live={live} cached={cached} pathname={pathname} />
        </>
      )}
    </div>
  )
}

/**
 * Phones only. On a wider viewport the control never covers anything, so it
 * never hides, so there is nothing to pin and no reason to spend a button
 * saying so.
 */
function PinToggle({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  const Icon = pinned ? PinIcon : PinOffIcon
  return (
    <button
      type='button'
      onClick={onToggle}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin the account button' : 'Keep the account button on screen'}
      title={pinned ? 'Unpin the account button' : 'Keep the account button on screen'}
      className={`btn-press pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur sm:hidden ${
        pinned
          ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-200'
          : 'border-white/10 bg-black/50 text-white/50'
      }`}
    >
      <Icon className='h-3.5 w-3.5' aria-hidden />
    </button>
  )
}

function Control({
  live,
  cached,
  pathname,
}: {
  live: ReturnType<typeof useAccount>
  cached: CachedProfile | null
  pathname: string
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
      //
      // The control sits on every page, so it is the one entry point that has
      // to come back to where it was used — being dropped on the homepage from
      // a platform landing page loses the visitor's place for no reason.
      // Pathname only, deliberately: the query string is where a failed
      // sign-in's `?signin=expired` lives, and carrying that through a
      // *successful* retry would land the visitor on their account under an
      // error notice about the attempt that just worked.
      <a
        href={signInHref(pathname)}
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
