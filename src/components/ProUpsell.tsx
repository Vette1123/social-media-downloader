'use client'

import Link from 'next/link'
import { CheckIcon } from '@/components/icons'
import { Surface } from '@/components/Surface'
import { PRO_CHECKOUT_URL, PRO_CTA_LABEL, PRO_PRICE } from '@/config/pro'
import { useTier } from '@/lib/entitlements'

/**
 * The only place Pro is sold outside /pro itself.
 *
 * It existed nowhere but two footer links, which is the same as not existing:
 * a visitor who lands on a platform page, downloads a video and leaves never
 * saw that there was anything to buy.
 *
 * Layout is an asymmetric split rather than another band of equal cards. Every
 * other section on the home page is a centred grid (four-across features,
 * three-across steps, platform pills), so repeating that shape would have made
 * this read as more of the same page furniture and slide straight past. The
 * offer sits on the left with the price and the one CTA; the right column
 * carries the actual list, so the split is doing compositional work rather
 * than parking a paragraph in a corner.
 */

const BENEFITS = [
  'Paste up to 20 links and let the queue run',
  'Priority resolving on every link',
  'No sponsor card, site-wide',
  'Reaches login-gated Instagram posts',
] as const

export function ProUpsell({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const tier = useTier()

  // Rendered by default and hidden only once the client confirms Pro. The
  // reverse (wait for hydration, then show) would leave a hole in the page for
  // every visitor in order to spare the few who already paid, and this is a
  // marketing section where that hole is the whole cost.
  if (tier === 'pro') return null

  if (variant === 'compact') {
    return (
      <Surface
        tone='accent'
        interaction='lift'
        className='flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center'
      >
        <div className='min-w-0'>
          <p className='font-semibold text-white'>
            Downloading more than one? Pro takes 20 at a time.
          </p>
          <p className='mt-1 text-sm text-white/60'>
            {PRO_PRICE} once, no account, no subscription. This page stays free
            either way.
          </p>
        </div>
        <Link
          href='/pro'
          className='btn-grad shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap'
        >
          {PRO_CTA_LABEL}
        </Link>
      </Surface>
    )
  }

  return (
    <Surface
      tone='accent'
      radius='3xl'
      className='animate-section-in grid items-center gap-8 p-6 sm:p-9 lg:grid-cols-12 lg:gap-12'
    >
      <div className='lg:col-span-7'>
        <h2 className='text-2xl font-bold tracking-tight text-balance text-white sm:text-3xl'>
          Twenty links at once, for {PRO_PRICE} once
        </h2>
        <p className='mt-3 text-sm text-white/70 md:text-base'>
          Everything on this site stays free. Pro is for the days you have a
          folder&apos;s worth of links and no patience.
        </p>

        <div className='mt-6 flex flex-wrap items-center gap-4'>
          <a
            href={PRO_CHECKOUT_URL}
            className='btn-grad rounded-xl px-6 py-3 text-sm font-semibold whitespace-nowrap'
          >
            {PRO_CTA_LABEL}
          </a>
          <Link
            href='/pro'
            className='text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline'
          >
            What you get
          </Link>
        </div>

        <p className='mt-4 text-xs text-white/40'>
          One-time payment. Lifetime key, up to 5 activations.
        </p>
      </div>

      <ul className='space-y-3 lg:col-span-5'>
        {BENEFITS.map((benefit) => (
          <li key={benefit} className='flex items-start gap-3'>
            <CheckIcon className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' />
            <span className='text-sm text-white/75'>{benefit}</span>
          </li>
        ))}
      </ul>
    </Surface>
  )
}
