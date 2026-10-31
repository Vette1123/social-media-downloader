'use client'

import { type ReactNode } from 'react'
import { useTier } from '@/lib/entitlements'

/**
 * Removes a server-rendered section for a supporter, so the section's own copy
 * never has to ship as JavaScript just to be able to hide.
 *
 * Rendered by default and hidden only once the client confirms the extras are
 * on. The reverse (wait for hydration, then show) would leave a hole in the page
 * for every visitor in order to spare the few who support this.
 */
export function HiddenForPro({ children }: { children: ReactNode }) {
  const tier = useTier()
  return tier === 'pro' ? null : children
}
