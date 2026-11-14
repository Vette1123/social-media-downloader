'use client'

import type { ReactNode } from 'react'
import { Surface } from '@/components/Surface'
import { trackFeatureUsed } from '@/lib/analytics'
import { motionScrollBehavior } from '@/lib/clientEnv'
import { featureCardFormat, PASTE_INPUT_ID, type FeatureCardId } from '@/lib/featureCard'
import { setFormat } from '@/lib/prefs'

/**
 * A home feature tile that does what it names: it sets the format and puts the
 * cursor in the paste bar. Before this it was a static card that lifted on
 * hover and did nothing on tap.
 */
export function FeatureCardButton({ id, children }: { id: FeatureCardId; children: ReactNode }) {
  const onClick = () => {
    setFormat(featureCardFormat(id))
    trackFeatureUsed('feature_card', { action: id })
    const input = document.getElementById(PASTE_INPUT_ID)
    if (!(input instanceof HTMLInputElement)) return
    input.scrollIntoView({ block: 'center', behavior: motionScrollBehavior() })
    input.focus({ preventScroll: true })
  }
  return (
    <Surface
      as='button'
      type='button'
      interaction='lift'
      onClick={onClick}
      className='group p-5 text-start'
    >
      {children}
    </Surface>
  )
}
