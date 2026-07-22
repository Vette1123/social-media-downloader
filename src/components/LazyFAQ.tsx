'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * FAQ section that stays cheap on first paint.
 *
 * The interactive version (Radix Accordion + lucide-react ChevronDown) only
 * downloads + hydrates after the browser is idle, or the user scrolls toward /
 * interacts with it. Until then we render a NATIVE <details>/<summary> version —
 * zero JavaScript, fully accessible, keyboard-operable, and 100% crawlable.
 *
 * The FAQ text is in the initial server HTML either way (in the <details>
 * fallback), so this is SEO-NEUTRAL — Google sees the full Q&A regardless of
 * which version is shown. The only thing deferred is the styled Radix UI's JS.
 *
 * Net effect: the Radix accordion chunk + lucide icon move off the critical
 * path, so they no longer compete with first paint / LCP for main-thread time
 * on slow devices — yet the user never sees a degraded experience: native
 * <details> expands/collapses fine, and swaps to the styled version seamlessly.
 */

interface FaqItem {
  q: string
  a: string
}

interface InteractiveFAQProps {
  items: FaqItem[]
  defaultOpenIndex?: number
}

// One dynamic import for the whole accordion module + the icon. ssr:false keeps
// their JS out of the initial bundle entirely.
const InteractiveFAQ = dynamic<InteractiveFAQProps>(
  () => import('./InteractiveFAQ').then((m) => m.InteractiveFAQ),
  {
    ssr: false,
    loading: () => null, // the native fallback below stays visible during load
  },
)

export function LazyFAQ({
  items,
  defaultOpenIndex = 0,
}: {
  items: FaqItem[]
  defaultOpenIndex?: number
}) {
  const [interactive, setInteractive] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let opened = false
    const open = () => {
      if (opened) return
      opened = true
      cleanup()
      const ric = idleCb()
      ric(() => setInteractive(true))
    }

    let io: IntersectionObserver | null = null
    if (ref.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.some((e) => e.isIntersecting) && open(),
        { rootMargin: '600px 0px' },
      )
      io.observe(ref.current)
    }
    // Hydrate on idle unconditionally so the styled version always lands, even
    // if the user never scrolls.
    const ric = idleCb()
    ric(open)

    const el = ref.current
    const events = ['pointerdown', 'touchstart', 'focusin'] as const
    events.forEach((e) => el?.addEventListener(e, open, { once: true }))

    function cleanup() {
      io?.disconnect()
      const e = ref.current
      if (e) events.forEach((ev) => e.removeEventListener(ev, open))
    }
    return cleanup
  }, [])

  return (
    <div ref={ref}>
      {interactive && (
        <InteractiveFAQ items={items} defaultOpenIndex={defaultOpenIndex} />
      )}
      {/* Until the interactive version mounts, the native fallback is visible.
          Once it mounts it replaces this in place (same markup shape). To avoid
          a double-render flash we hide the fallback once interactive is true. */}
      {!interactive && (
        <div className='space-y-3'>
          {items.map((f, i) => (
            <details
              key={f.q}
              open={i === defaultOpenIndex}
              className='group border border-white/[0.08] rounded-xl bg-white/[0.03] overflow-hidden transition-colors hover:bg-white/[0.05]'
            >
              <summary className='flex flex-1 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left text-sm md:text-base font-semibold text-white transition-colors hover:text-cyan-200'>
                {f.q}
                <svg
                  className='h-4 w-4 shrink-0 text-white/60 transition-transform duration-200 group-open:rotate-180'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  aria-hidden
                >
                  <path d='m6 9 6 6 6-6' />
                </svg>
              </summary>
              <div className={cn('px-4 pb-4 pt-0 text-sm leading-relaxed text-white/75')}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

function idleCb() {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void) => number
  }
  return (
    w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
  )
}
