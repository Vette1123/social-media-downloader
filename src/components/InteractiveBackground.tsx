'use client'

import { useEffect, useRef } from 'react'

/**
 * Ambient page background: a slowly panning grid, a cursor spotlight that lights
 * the grid lines in the accent hue, and three accent blobs that ease toward the
 * pointer. All motion is driven through CSS custom properties (no React state,
 * no re-renders) and collapses to a static frame under prefers-reduced-motion.
 */
export function InteractiveBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const hotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    const hot = hotRef.current
    if (!root || !hot) return
    // Pointer tracking is a desktop/mouse effect — a touch screen never
    // triggers a useful hover, so skip wiring it up entirely on coarse
    // pointers (cheap client check) and on low-power-flagged devices. This
    // removes the per-frame rAF work on phones without affecting desktop.
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
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3))
        root.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3))
        hot.style.setProperty('--px', `${e.clientX}px`)
        hot.style.setProperty('--py', `${e.clientY}px`)
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className='pointer-events-none absolute inset-0 overflow-hidden'
    >
      <div className='bg-blob bg-blob-1' />
      <div className='bg-blob bg-blob-2' />
      <div className='bg-blob bg-blob-3' />
      <div className='bg-grid' />
      <div ref={hotRef} className='bg-grid-hot' />
      <div className='bg-grain' />
    </div>
  )
}
