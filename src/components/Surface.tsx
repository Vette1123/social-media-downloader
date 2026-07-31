import { type ComponentProps, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CardSpotlight } from '@/components/CardSpotlight'

/**
 * THE card. Every bordered panel on this site renders through here.
 *
 * It exists because the same bug kept coming back: a card was a hand-written
 * `rounded-2xl border border-white/[0.08] bg-white/[0.03]`, repeated twenty-one
 * times with four different border alphas and three different fills — and every
 * one of those fills was translucent. The page ground underneath carries a
 * grid, a grain layer and three big blurred cyan blobs, so the blobs painted
 * straight through the card interiors: panels looked like a gradient smear
 * instead of solid objects. Fixing one card never fixed the others, because
 * there was nothing shared to fix.
 *
 * Now the fill, the border and the hover response live in exactly one place
 * (`.surface` in globals.css) and every panel opts into them by construction.
 * The fill is opaque; tints are mixed into the panel colour instead of being
 * layered over the page.
 *
 * This is a SERVER component. The cursor spotlight that `glow` adds is the only
 * part that needs JS, and it is isolated in its own tiny client leaf
 * (CardSpotlight), so a card's static children never hydrate.
 */

/** Border + fill language. `accent` sells, `positive` confirms. */
type SurfaceTone = 'neutral' | 'accent' | 'positive'

/**
 * `base` sits on the page ground. `raised` sits on top of another surface —
 * stacking two identical fills reads flat, so it steps up one stop. Reaching
 * for transparency to get that separation is what caused the bug this component
 * exists to kill.
 */
type SurfaceElevation = 'base' | 'raised'

/**
 * `lift` moves on hover (tiles, links, pills). `hover` gives the same surface
 * response with NO movement, for things that must not shift under the pointer
 * (accordion rows, rows in a scrolling panel). `none` is inert.
 */
type SurfaceInteraction = 'lift' | 'hover' | 'none'

type SurfaceRadius = 'lg' | 'xl' | '2xl' | '3xl' | 'none'

type SurfaceOwnProps = {
  tone?: SurfaceTone
  elevation?: SurfaceElevation
  interaction?: SurfaceInteraction
  radius?: SurfaceRadius
  /** The perimeter sheen + cursor spotlight. Hero-weight cards only. */
  glow?: boolean
  className?: string
  children?: ReactNode
}

/**
 * ComponentProps (not ComponentPropsWithoutRef): under React 19 `ref` is an
 * ordinary prop on function components, so a caller can pass one straight
 * through the rest spread — the paste bar in DownloaderApp needs that.
 */
type SurfaceProps<T extends ElementType> = SurfaceOwnProps & {
  as?: T
} & Omit<ComponentProps<T>, keyof SurfaceOwnProps | 'as'>

const TONE_CLASS: Record<SurfaceTone, string> = {
  neutral: '',
  accent: 'surface-accent',
  positive: 'surface-positive',
}

const INTERACTION_CLASS: Record<SurfaceInteraction, string> = {
  lift: 'card-lift',
  hover: 'card-hover',
  none: '',
}

const RADIUS_CLASS: Record<SurfaceRadius, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  none: '',
}

export function Surface<T extends ElementType = 'div'>({
  as,
  tone = 'neutral',
  elevation = 'base',
  interaction = 'none',
  radius = '2xl',
  glow = false,
  className,
  children,
  ...rest
}: SurfaceProps<T>) {
  const Component = (as ?? 'div') as ElementType

  return (
    <Component
      className={cn(
        'surface',
        elevation === 'raised' && 'surface-raised',
        TONE_CLASS[tone],
        INTERACTION_CLASS[interaction],
        RADIUS_CLASS[radius],
        glow && 'glow-card',
        className,
      )}
      {...rest}
    >
      {/* Sits above the ::before ring but below content (content is z-2). */}
      {glow && <CardSpotlight />}
      {children}
    </Component>
  )
}
