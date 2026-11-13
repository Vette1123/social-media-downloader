'use client'

import { type ComponentType, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/components/icons'
import { Surface } from '@/components/Surface'

/**
 * FAQ section that stays cheap on first paint.
 *
 * The interactive version (the Radix Accordion) only downloads + hydrates after
 * the browser is idle, or the user scrolls toward / interacts with it. Until
 * then we render a NATIVE <details>/<summary> version — zero JavaScript, fully
 * accessible, keyboard-operable, and 100% crawlable.
 *
 * The FAQ text is in the initial server HTML either way (in the <details>
 * fallback), so this is SEO-NEUTRAL — Google sees the full Q&A regardless of
 * which version is shown. The only thing deferred is the styled Radix UI's JS.
 *
 * Net effect: the Radix accordion chunk moves off the critical
 * path, so it no longer competes with first paint / LCP for main-thread time
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

/**
 * The accordion module, fetched before anything on screen changes.
 *
 * next/dynamic renders its `loading` slot while the chunk downloads, and the
 * fallback had to be gone by then, so the whole FAQ collapsed to nothing and
 * came back: a 1,100 px shift under anyone scrolling toward it. The component
 * is now held in state and set only once its module has arrived, so the swap
 * is one render, fallback out and accordion in.
 */
export function loadInteractiveFAQ(): Promise<ComponentType<InteractiveFAQProps>> {
  return import('./InteractiveFAQ').then((m) => m.InteractiveFAQ)
}

export function LazyFAQ({
  items,
  defaultOpenIndex = 0,
}: {
  items: FaqItem[]
  defaultOpenIndex?: number
}) {
  const [Interactive, setInteractive] = useState<ComponentType<InteractiveFAQProps> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let opened = false
    const open = () => {
      if (opened) return
      opened = true
      cleanup()
      const ric = idleCb()
      ric(() => {
        loadInteractiveFAQ()
          .then((faq) => setInteractive(() => faq))
          .catch(() => {}) // the native <details> below keeps working
      })
    }

    let io: IntersectionObserver | null = null
    if (ref.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.some((e) => e.isIntersecting) && open(),
        { rootMargin: '600px 0px' },
      )
      io.observe(ref.current)
    }
    // No load on idle: the native <details> below already works, so someone who
    // never reaches the FAQ never pays for the accordion library.

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
      {Interactive && <Interactive items={items} defaultOpenIndex={defaultOpenIndex} />}
      {/* The native fallback stays until the accordion's module has arrived,
          then both swap in the same render (same markup shape). */}
      {!Interactive && (
        <div className='space-y-3'>
          {items.map((f, i) => (
            <Surface
              key={f.q}
              as='details'
              open={i === defaultOpenIndex}
              interaction='hover'
              radius='xl'
              className='group overflow-hidden'
            >
              <summary className='flex flex-1 list-none items-center justify-between gap-4 px-4 py-4 text-left text-sm md:text-base font-semibold text-white transition-colors hover:text-cyan-200'>
                {f.q}
                {/* Same glyph the interactive version uses, so the swap is
                    invisible — one definition, in icons.tsx. */}
                <ChevronDownIcon
                  className='h-4 w-4 shrink-0 text-white/60 transition-transform duration-200 group-open:rotate-180'
                  aria-hidden
                />
              </summary>
              <div className='px-4 pb-4 pt-0 text-sm leading-relaxed text-white/75'>{f.a}</div>
            </Surface>
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
