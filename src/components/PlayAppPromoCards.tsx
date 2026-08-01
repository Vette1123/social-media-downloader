'use client'

import { GooglePlayIcon } from '@/components/icons'
import { LinkCard } from '@/components/LinkCard'
import { openOnPlayStore, PLAY_APPS, PlayApp } from '@/lib/apps'

// Attention-grabbing hero card promoting one of our apps. Same shell as the
// dev-link cards (LinkCard owns the geometry) with a Google-Play-green sheen,
// and prefers the native Play Store app — falling back to the web listing.
export function PlayAppPromoCard({ app }: { app: PlayApp }) {
  return (
    <LinkCard
      href={app.playStoreUrl}
      label={app.name}
      Icon={GooglePlayIcon}
      iconHoverClass='group-hover:text-white'
      title={`${app.name} — an app made by us, on Google Play`}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault()
        openOnPlayStore(app)
      }}
      className='overflow-hidden'
    >
      <span
        className='absolute inset-0 bg-gradient-to-r from-emerald-500/80 to-green-400/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100'
        aria-hidden
      />
      <span
        className='pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10 transition-all duration-300 group-hover:ring-white/30'
        aria-hidden
      />
    </LinkCard>
  )
}

// One card per app, in the hero's dev-link row.
export function PlayAppPromoCards() {
  return (
    <>
      {PLAY_APPS.map((app) => (
        <PlayAppPromoCard key={app.androidPackage} app={app} />
      ))}
    </>
  )
}
