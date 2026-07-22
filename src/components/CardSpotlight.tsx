'use client'

import { useEffect, useRef } from 'react'

/**
 * A zero-content marker that attaches a throttled (rAF) pointermove listener to
 * its parent .glow-card and writes card-local coordinates to that card's CSS
 * custom properties (--cx/--cy). The card's ::after radial gradient reads those
 * to paint the spotlight.
 *
 * This is deliberately split out from GlowCard so GlowCard can be a SERVER
 * component — its static children (icon row, headline, chips, links) then render
 * as plain HTML and never enter the RSC flight payload or hydrate. Only this
 * tiny leaf hydrates, instead of the whole hero tree.
 *
 * It renders nothing visible (an empty, non-interacting marker). The listener is
 * bound to the PARENT card via closest('.glow-card'), so it never intercepts
 * clicks meant for content — events bubble up from content to the card normally.
 */
export function CardSpotlight() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const marker = ref.current
    const card = marker?.closest('.glow-card') as HTMLElement | null
    if (!card) return
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(hover: none)').matches ||
      document.documentElement.classList.contains('low-power')
    ) {
      return
    }

    let raf = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      const { clientX, clientY } = e
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--cx', `${clientX - r.left}px`)
        card.style.setProperty('--cy', `${clientY - r.top}px`)
      })
    }
    card.addEventListener('pointermove', onMove)
    return () => {
      card.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  // An empty marker — invisible, non-interacting, present only so we can resolve
  // the parent card in the effect. display:contents removes it from layout/box
  // entirely so it can never affect the card's sizing or layering.
  return <span ref={ref} aria-hidden style={{ display: 'contents' }} />
}
