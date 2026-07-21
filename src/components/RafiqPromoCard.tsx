'use client'

import { GooglePlayIcon } from '@/components/icons'
import { openRafiqOnPlayStore, RAFIQ_PLAY_STORE_URL } from '@/lib/rafiq'

// Attention-grabbing hero card promoting Rafiq, our companion app. Matches the
// dev-link cards' styling but with a Google-Play-green sheen, and prefers the
// native Play Store app (falling back to the web listing) on click.
export function RafiqPromoCard() {
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
      className='group relative flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-xl bg-white/5 border border-white/15 overflow-hidden backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
    >
      <span
        className='absolute inset-0 bg-gradient-to-r from-emerald-500/80 to-green-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
        aria-hidden
      />
      <span
        className='pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-white/30 transition-all duration-300'
        aria-hidden
      />
      <GooglePlayIcon className='relative w-[18px] h-[18px] shrink-0 text-white/80 group-hover:text-white transition-colors duration-300' />
      <span className='relative text-white/80 group-hover:text-white text-sm font-medium transition-colors duration-300'>
        Rafiq
      </span>
    </a>
  )
}
