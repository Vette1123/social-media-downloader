import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

type IconProps = { className?: string }

/** Every launcher icon `pnpm apps:icons` writes to public/apps/. */
export const APP_ICON_SLUGS = ['rafiq', 'masareef', 'nafis', 'reely'] as const

/**
 * An app's real launcher icon (public/apps/<slug>.webp) as an `Icon`-shaped
 * component, so it drops into the slots the generic phone glyph used: the
 * footer menu, the hero's app cards (LinkCard), the Reely link. Ported from
 * Reely's components/companion-app-icon.tsx.
 *
 * A plain <img>: a 120px file shown at 16-40 CSS px, so next/image buys
 * nothing. Decorative (`alt=""`): every slot prints the app's name beside it.
 * One component per slug, built once, so a re-render never remounts it.
 */
function makeIcon(slug: string): ComponentType<IconProps> {
  function AppIcon({ className }: IconProps) {
    return (
      <img
        src={`/apps/${slug}.webp`}
        alt=''
        width={120}
        height={120}
        loading='lazy'
        decoding='async'
        draggable={false}
        className={cn('shrink-0 rounded-[22%] object-cover ring-1 ring-white/10', className)}
      />
    )
  }
  AppIcon.displayName = `AppIcon(${slug})`
  return AppIcon
}

const cache = new Map<string, ComponentType<IconProps>>()

export function appIcon(slug: string): ComponentType<IconProps> {
  let icon = cache.get(slug)
  if (!icon) {
    icon = makeIcon(slug)
    cache.set(slug, icon)
  }
  return icon
}
