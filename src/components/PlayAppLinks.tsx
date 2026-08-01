'use client'

import { Fragment } from 'react'
import { GooglePlayIcon } from '@/components/icons'
import { openOnPlayStore, PLAY_APPS, PlayApp } from '@/lib/apps'

// Link to one of our apps. Renders a real Play Store anchor (right-click /
// no-JS friendly) but intercepts the click to prefer the native Play Store
// app, falling back to the web listing — matching the apps' own logic.
export function PlayAppLink({
  app,
  className = 'inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors',
  iconClassName = 'w-4 h-4',
}: {
  app: PlayApp
  className?: string
  iconClassName?: string
}) {
  return (
    <a
      href={app.playStoreUrl}
      target='_blank'
      rel='noopener noreferrer'
      title={`${app.name} — an app made by us, on Google Play`}
      onClick={(e) => {
        e.preventDefault()
        openOnPlayStore(app)
      }}
      className={className}
    >
      <GooglePlayIcon className={iconClassName} />
      {app.name}
    </a>
  )
}

// The footer's full set of app links, dot-separated.
export function PlayAppLinks() {
  return (
    <span className='inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1'>
      {PLAY_APPS.map((app, i) => (
        <Fragment key={app.androidPackage}>
          {i > 0 && (
            <span aria-hidden className='text-white/20'>
              ·
            </span>
          )}
          <PlayAppLink app={app} />
        </Fragment>
      ))}
      <span className='text-white/40'>— apps made by us</span>
    </span>
  )
}
