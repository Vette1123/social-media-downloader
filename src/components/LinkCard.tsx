import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Surface } from '@/components/Surface'
import { linkCardWidth, type PhoneWidth } from '@/lib/heroLayout'
import { cn } from '@/lib/utils'

/**
 * The small icon+label pill used in the hero's dev / companion-app row.
 *
 * The sizing lives here and only here. It used to be `flex-1` (i.e.
 * `flex-basis: 0`) on every card, which tells the flex line every item is
 * zero-wide — so all five cards claimed one row on a phone and the last three
 * were sliced in half ("Ra", "Masa"). The basis is now a real half-row, so
 * exactly two fit per line; the app cards take a third (see lib/heroLayout).
 * From `sm` up the cards size to their content and wrap naturally.
 */
const CARD_CLASS =
  'group flex min-w-0 grow items-center justify-center gap-2 py-2.5 sm:basis-auto sm:grow-0 sm:px-4'

type LinkCardProps = {
  label: string
  Icon: React.ComponentType<{ className?: string }>
  /** Hover colour for the icon — the Play cards go white over their green sheen. */
  iconHoverClass?: string
  /** Share of a phone row; ignored from `sm` up. */
  phoneWidth?: PhoneWidth
  /** Decoration painted under the content (the Play cards' sheen). */
  children?: ReactNode
} & ComponentPropsWithoutRef<'a'>

export function LinkCard({
  label,
  Icon,
  iconHoverClass = 'group-hover:text-cyan-300',
  className,
  children,
  phoneWidth = 'half',
  ...rest
}: LinkCardProps) {
  const width = linkCardWidth(phoneWidth)
  return (
    <Surface
      as='a'
      target='_blank'
      rel='noopener noreferrer'
      elevation='raised'
      interaction='lift'
      radius='xl'
      className={cn(CARD_CLASS, width.card, className)}
      {...rest}
    >
      {children}
      <Icon
        className={cn(
          'relative h-[18px] w-[18px] shrink-0 text-white/80 transition-colors duration-300',
          width.icon,
          iconHoverClass,
        )}
      />
      <span className='relative text-sm font-medium text-white/80 transition-colors duration-300 group-hover:text-white'>
        {label}
      </span>
    </Surface>
  )
}
