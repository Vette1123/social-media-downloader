import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/SiteFooter'
import { Surface } from '@/components/Surface'
import { CheckIcon, CoffeeIcon } from '@/components/icons'
import { PRO_BENEFITS } from '@/config/pro'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Support this project',
  description:
    'This downloader is free and stays free. If it saved you time, you can buy me a coffee — supporters get the batch queue, ZIP bundling, priority resolve and an ad-free site.',
  alternates: { canonical: '/pro' },
}

/**
 * The page that used to sell a subscription.
 *
 * It is a donation page now. Two merchants of record refused to process
 * payments for a third-party downloader, the second after every fixable item on
 * their review checklist had been fixed, so there is nothing to buy here and
 * nothing that renews.
 *
 * The extras are still real, and they are still the same four: properties of
 * this site, none of which widen what a link can reach. They are switched on by
 * hand, which is slow and entirely deliberate — a manual grant needs no
 * merchant of record, no entitlement to enforce, and no refund policy, because
 * a tip is not a sale.
 *
 * What this page must never do is imply the tip buys reach. That claim is what
 * every acceptable-use policy in this space prohibits, and it is what closed
 * the store.
 */
export default function Support() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <div className='text-center'>
          <span className='btn-grad inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
            <CoffeeIcon className='h-3.5 w-3.5' />
            Support
          </span>
          <h1 className='mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl'>
            Free forever. <span className='text-grad'>Not free to run.</span>
          </h1>
          <p className='mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base'>
            Every download on this site is free, with no account and no limits,
            and that is not changing. If it has saved you some time, a coffee
            covers a bit of what it costs to keep the resolvers up.
          </p>
        </div>

        <Surface
          glow
          radius='3xl'
          className='animate-card-enter mt-8 p-5 shadow-2xl sm:p-8'
        >
          <a
            href={siteConfig.links.sponsor}
            target='_blank'
            rel='noopener noreferrer'
            className='btn-grad btn-press flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold sm:text-base'
          >
            <CoffeeIcon className='h-4 w-4' />
            Buy me a coffee
          </a>

          <p className='mt-4 text-center text-sm text-white/60'>
            One-off, any amount, no account here needed. Nothing renews and
            there is nothing to cancel.
          </p>

          <div className='mt-8 border-t border-white/10 pt-6'>
            <h2 className='text-lg font-semibold text-white'>
              Supporters get the extras
            </h2>
            <p className='mt-1 text-sm text-white/60'>
              Sign in with Google, then email{' '}
              <a
                className='text-cyan-300 hover:text-cyan-200'
                href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent('Supporter — switch on the extras')}`}
              >
                {siteConfig.supportEmail}
              </a>{' '}
              from the address on your receipt and I&rsquo;ll switch them on for
              your account. It is done by hand, so give it a day.
            </p>

            <ul className='mt-5 grid gap-3 sm:grid-cols-2'>
              {PRO_BENEFITS.map((benefit) => (
                <li key={benefit} className='flex items-start gap-3'>
                  <CheckIcon className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' aria-hidden />
                  <span className='text-sm text-white/75'>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className='mt-6 text-sm text-white/60'>
            All four are about doing the same work without standing over it — a
            queue instead of one link at a time, one ZIP instead of twelve
            files. None of them reach anything a visitor without them cannot
            already download, and none of them involve this site signing in
            anywhere on your behalf. Everything free today stays free whether
            anyone supports this or not.
          </p>
        </Surface>

        <p className='mt-6 text-center text-xs text-white/50'>
          Supporting this is a tip, not a purchase: no subscription, no invoice
          from us, and no refund policy, because nothing is being sold. Payments
          are handled entirely by Buy Me a Coffee under their own terms.
          Questions:{' '}
          <a
            className='text-cyan-300 hover:text-cyan-200'
            href={`mailto:${siteConfig.supportEmail}`}
          >
            {siteConfig.supportEmail}
          </a>
          , answered by{' '}
          <a className='text-cyan-300 hover:text-cyan-200' href={siteConfig.author.url}>
            {siteConfig.author.name}
          </a>
          .
        </p>

        <Link href='/' className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'>
          Back to the downloader
        </Link>

        <SiteFooter />
      </div>
    </div>
  )
}
