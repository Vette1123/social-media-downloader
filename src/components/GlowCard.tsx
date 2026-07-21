'use client'

import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The main frosted panel: a slow cyan sheen glides its perimeter (CSS) and a
 * soft spotlight follows the cursor across its surface. Pointer tracking writes
 * card-local coordinates to CSS custom properties — no state, no re-renders.
 */
export function GlowCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  let raf = 0

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf)
    const { clientX, clientY } = e
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--cx', `${clientX - r.left}px`)
      el.style.setProperty('--cy', `${clientY - r.top}px`)
    })
  }

  return (
    <div ref={ref} onPointerMove={onMove} className={cn('glow-card', className)}>
      {children}
    </div>
  )
}
