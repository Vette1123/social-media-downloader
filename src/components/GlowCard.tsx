import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CardSpotlight } from '@/components/CardSpotlight'

/**
 * The main frosted panel: a slow cyan sheen glides its perimeter (CSS) over a
 * faint static outline and a soft bloom. The cursor spotlight is handled by a
 * tiny isolated client island (CardSpotlight) so this component itself stays a
 * SERVER component — its static children never hydrate.
 */
export function GlowCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('glow-card', className)}>
      {/* Cursor spotlight — the only piece of the card that needs JS. Sits
          above the ::before ring but below content (content is z-2). */}
      <CardSpotlight />
      {children}
    </div>
  )
}
