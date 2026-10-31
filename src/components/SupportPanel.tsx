import Link from '@/components/IntentLink'
import { HiddenForPro } from '@/components/HiddenForPro'
import { CheckIcon, CoffeeIcon } from '@/components/icons'
import { Surface } from '@/components/Surface'
import { SUPPORT_PRICES } from '@/config/support'
import { fill, type Locale } from '@/lib/i18n'
import { contentFor } from '@/lib/localeContent'

/**
 * The ask, on the home page and on every platform landing page.
 *
 * This was `ProUpsell` and sold a $3/month subscription. Nothing is sold now —
 * two merchants of record refused the product category — so it asks for a tip
 * instead and names the thank-you rather than a price.
 *
 * Layout is unchanged and deliberately so: an asymmetric split rather than
 * another band of equal cards. Every other section on the home page is a
 * centred grid (four-across features, three-across steps, platform pills), so
 * repeating that shape would make this read as more page furniture and slide
 * straight past. The ask sits on the left with the one CTA; the right column
 * carries the list, so the split does compositional work rather than parking a
 * paragraph in a corner.
 *
 * The copy constraint outlived the subscription: nothing here may suggest that
 * supporting the project reaches content a visitor cannot already download.
 * That claim is the acceptable-use clause every processor in this space
 * prohibits, and it does not stop being true because there is no processor.
 */
export function SupportPanel({
  variant = 'full',
  locale = 'en',
}: {
  variant?: 'full' | 'compact'
  locale?: Locale
}) {
  const { support } = contentFor(locale).copy
  if (variant === 'compact') {
    return (
      <HiddenForPro>
      <Surface
        tone='accent'
        interaction='lift'
        className='flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center'
      >
        <div className='min-w-0'>
          <p className='font-semibold text-white'>{support.compactTitle}</p>
          <p className='mt-1 text-sm text-white/60'>
            {fill(support.compactBody, { monthly: SUPPORT_PRICES.monthly })}
          </p>
        </div>
        <Link
          href='/pro'
          data-pro-cta='support_panel'
          className='btn-grad inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap'
        >
          <CoffeeIcon className='h-4 w-4' />
          {support.coffee}
        </Link>
      </Surface>
      </HiddenForPro>
    )
  }

  return (
    <HiddenForPro>
    <Surface
      tone='accent'
      radius='3xl'
      className='animate-section-in grid items-center gap-8 p-6 sm:p-9 lg:grid-cols-12 lg:gap-12'
    >
      <div className='lg:col-span-7'>
        <h2 className='text-2xl font-bold tracking-tight text-balance text-white sm:text-3xl'>
          {support.title}
        </h2>
        <p className='mt-3 text-sm text-white/70 md:text-base'>
          {support.body}
        </p>

        <div className='mt-6 flex flex-wrap items-center gap-4'>
          <Link
            href='/pro'
            data-pro-cta='support_monthly'
            className='btn-grad inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold whitespace-nowrap'
          >
            <CoffeeIcon className='h-4 w-4' />
            {fill(support.monthly, { monthly: SUPPORT_PRICES.monthly })}
          </Link>
          <Link
            href='/pro'
            data-pro-cta='support_lifetime'
            className='text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline'
          >
            {fill(support.lifetime, { lifetime: SUPPORT_PRICES.lifetime })}
          </Link>
        </div>

        <p className='mt-4 text-xs text-white/50'>
          {support.note}
        </p>
      </div>

      <ul className='space-y-3 lg:col-span-5'>
        {support.benefits.map((benefit) => (
          <li key={benefit.title} className='flex items-start gap-3'>
            <CheckIcon className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' />
            <span className='text-sm text-white/75'>
              <strong className='font-semibold text-white'>{benefit.title}.</strong>{' '}
              {benefit.body}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
    </HiddenForPro>
  )
}
