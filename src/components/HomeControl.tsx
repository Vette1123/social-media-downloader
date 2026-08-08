'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { HomeIcon } from '@/components/icons'
import { usePeekOnScroll } from '@/lib/clientEnv'

/**
 * The way back to the downloader, top-left on every page but the home page.
 *
 * This site has no header bar and is not getting one — every page is a
 * standalone layout tuned to a 96 mobile Lighthouse score. But it has grown
 * pages you can be *on* rather than pass through: /pro, /account, /terms, the
 * eleven platform landings. Most arrive from search, so the browser's Back
 * button frequently leads to Google rather than to us, and the only route home
 * was a text link at the very bottom of the page.
 *
 * It mirrors the account control exactly — same slot geometry, same auto-hide
 * on a phone (see `usePeekOnScroll`) — so the two read as one line of chrome
 * rather than two unrelated floating buttons.
 *
 * On the home page it renders nothing: a button that goes where you already are
 * is furniture, and this is a site whose home page is the product.
 */
export function HomeControl() {
  // Not read once from `window.location`: this lives in the root layout and
  // survives client-side navigation, so a value captured at mount goes stale
  // the moment someone moves between pages.
  const pathname = usePathname()
  const slot = useRef<HTMLDivElement>(null)

  // Always called, never conditionally: the early return below happens after,
  // so the hook order is stable across the home page and every other page.
  usePeekOnScroll(slot, true)

  if (pathname === '/') return null

  return (
    <div
      ref={slot}
      className='corner-slot corner-slot--left pointer-events-none fixed z-50 flex h-10 items-center gap-1.5 sm:h-9'
    >
      <Link
        href='/'
        title='Back to the downloader'
        className='btn-press pointer-events-auto group flex items-center gap-2 rounded-full border border-white/10 bg-black/50 p-2 backdrop-blur transition-colors hover:border-white/25 sm:py-1.5 sm:pr-3.5 sm:pl-3'
      >
        <HomeIcon className='h-4 w-4 text-white/70 transition-colors group-hover:text-white' />
        {/* Hidden on phones, where this shares the line with the account pill,
            the pin toggle and the Pro pill and there is no room for a word. */}
        <span className='hidden text-xs font-medium text-white/70 transition-colors group-hover:text-white sm:block'>
          Downloader
        </span>
      </Link>
    </div>
  )
}
