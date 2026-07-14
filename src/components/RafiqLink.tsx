'use client'

import { ReactNode } from 'react'
import { GooglePlayIcon } from '@/components/icons'
import { openRafiqOnPlayStore, RAFIQ_PLAY_STORE_URL } from '@/lib/rafiq'

// Link to Rafiq, our companion app. Renders a real Play Store anchor
// (right-click / no-JS friendly) but intercepts the click to prefer the native
// Play Store app, falling back to the web listing — matching Rafiq's own logic.
export function RafiqLink({
  className = 'inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors',
  iconClassName = 'w-4 h-4',
  children = 'Rafiq',
}: {
  className?: string
  iconClassName?: string
  children?: ReactNode
}) {
  return (
    <a
      href={RAFIQ_PLAY_STORE_URL}
      target='_blank'
      rel='noopener noreferrer'
      title='Rafiq — an app made by us, on Google Play'
      onClick={(e) => {
        e.preventDefault()
        openRafiqOnPlayStore()
      }}
      className={className}
    >
      <GooglePlayIcon className={iconClassName} />
      {children}
    </a>
  )
}
