import type { PageCopy } from '@/lib/pageCopy'

/**
 * Phone sizing for the hero's link cards. Five cards at half a row each wrap
 * 2 + 2 + 1 and leave one stranded on its own line (Nafis, 14 Nov). The two
 * dev links stay at half a row, the three apps take a third each, so the rows
 * read 2 + 3. A third of a phone row is about 100 px, too narrow for the icon
 * plus "Masareef", and the apps icon is the same on all three, so it hides
 * below `sm`. From `sm` up every card sizes to its content.
 */
export type PhoneWidth = 'half' | 'third'

export function linkCardWidth(width: PhoneWidth): { card: string; icon: string } {
  if (width === 'third') {
    return { card: 'basis-[calc(33.333%-0.334rem)] px-2', icon: 'hidden sm:block' }
  }
  return { card: 'basis-[calc(50%-0.25rem)] px-3', icon: '' }
}

/**
 * The home hero's checklist. The line above the paste bar already says "free,
 * no account, no limits" (and its link is the top support CTA, 14 people in
 * 30 days), so the checklist repeated three of its four points and wrapped
 * 3 + 2 on a phone. Platform pages have no such line and keep the full set.
 */
export function homeHeroChips(chips: PageCopy['chips']): string[] {
  return [chips.hd]
}
