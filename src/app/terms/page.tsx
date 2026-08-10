import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms for using ${siteConfig.name}: as-is service, your responsibility for content rights, and Pro subscription billing.`,
  alternates: { canonical: '/terms' },
}

const UPDATED = '8 August 2026'

export default function Terms() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <h1 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          Terms of Service
        </h1>
        <p className='mt-2 text-sm text-white/50'>Last updated {UPDATED}</p>

        <div className='mt-8 space-y-6 text-sm leading-relaxed text-white/70 md:text-base'>
          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Provided as-is</h2>
            <p>
              {siteConfig.name} is provided &ldquo;as is&rdquo; with no warranty of
              any kind, express or implied. We do not guarantee uninterrupted
              access, that every link will resolve, or that any particular
              platform will keep working.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Your responsibility</h2>
            <p>
              You are responsible for having the right to download any content
              you process through this site &mdash; your own uploads, content
              you have permission to save, or material that is otherwise legally
              yours to download. We do not host or vet the media you link to.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>No commercial redistribution</h2>
            <p>
              Downloaded media is for personal use. You may not resell,
              re-upload for profit, or otherwise commercially redistribute
              content you did not create or license.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>What this site will not do</h2>
            <p>
              {siteConfig.name} reaches only what is already publicly
              accessible. It does not bypass DRM, defeat a paywall, sign in on
              your behalf, or reach private accounts, subscriber-only posts, or
              anything else a platform serves only to a logged-in viewer. No
              subscription tier changes this: Pro affects how work is queued
              and how results are packaged, never what a link can reach.
            </p>
            <p className='mt-2'>
              Using this site to infringe copyright, or to access material you
              have no right to, is a breach of these terms. We may refuse
              service or close an account for it.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Trademarks and affiliation</h2>
            <p>
              {siteConfig.name} is an independent tool and is{' '}
              <strong className='text-white/90'>
                not affiliated with, endorsed by, or sponsored by
              </strong>{' '}
              TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit,
              Threads, Snapchat, Twitch, Vimeo, or any other platform named on
              this site. Those names and logos belong to their respective
              owners and are used only to describe which links this tool
              accepts.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Rights holders</h2>
            <p>
              We do not host, store, or index media. Files are fetched from the
              source platform at the moment you ask for them and are never kept
              on our servers, so there is nothing here to take down. If you
              believe this service is being used to infringe your rights, email{' '}
              <a
                className='text-cyan-300 hover:text-cyan-200'
                href={`mailto:${siteConfig.supportEmail}`}
              >
                {siteConfig.supportEmail}
              </a>{' '}
              and we will respond.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Pro billing</h2>
            <p>
              {siteConfig.name} trades as{' '}
              <strong className='text-white/90'>{siteConfig.seller}</strong>. Pro
              is a subscription, billed monthly or annually, processed by{' '}
              {siteConfig.merchantOfRecord}, who act as merchant of record. It
              renews automatically at the end of each billing period until you
              cancel.
            </p>
            <p className='mt-2'>
              Your receipt and your card statement will therefore show{' '}
              {siteConfig.seller} or {siteConfig.merchantOfRecord}, not{' '}
              {siteConfig.shortName}. A charge you do not recognise is almost
              always this &mdash; email{' '}
              <a
                className='text-cyan-300 hover:text-cyan-200'
                href={`mailto:${siteConfig.supportEmail}`}
              >
                {siteConfig.supportEmail}
              </a>{' '}
              before disputing it with your bank and we will sort it out faster
              than a chargeback can.
            </p>
            <p className='mt-2'>
              Cancel any time from your account&rsquo;s billing portal.
              Cancelling stops the next renewal and nothing else: Pro stays
              active for the rest of the period you have already paid for, and
              reverts to free when that period ends. There is no partial
              period and nothing is cut off early.
            </p>
            <p className='mt-2'>
              If a renewal payment fails, we keep Pro active for 14 days while
              {siteConfig.merchantOfRecord} retries the charge, so a card update usually
              recovers the subscription with no interruption. If payment still
              has not gone through after 14 days, Pro access ends.
            </p>
            <p className='mt-2'>
              <strong className='text-white/90'>
                Refunds: 14 days, no questions asked.
              </strong>{' '}
              Email us within 14 days of any charge &mdash; the first one or a
              renewal &mdash; and we refund it in full and end the
              subscription. After 14 days a period that has already been billed
              is not refundable; cancelling is what stops the next charge, and
              Pro stays active for the rest of the period you paid for.
            </p>
            <p className='mt-2'>
              To request one, email{' '}
              <a
                className='text-cyan-300 hover:text-cyan-200'
                href={`mailto:${siteConfig.supportEmail}`}
              >
                {siteConfig.supportEmail}
              </a>{' '}
              from the address on your receipt. Refunds are issued by{' '}
              {siteConfig.merchantOfRecord} to the original payment method and
              usually appear within 5&ndash;10 business days.
            </p>
            <p className='mt-2'>
              If you were charged after cancelling, or charged twice, that is a
              billing error rather than a refund request: email us and we will
              correct it at any time, not only inside the 14 days. Nothing here
              affects the statutory rights you have where you live &mdash;
              including the EU/UK right of withdrawal &mdash; or the policies of{' '}
              {siteConfig.merchantOfRecord}, who are the merchant of record on
              every transaction.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Changes to the service</h2>
            <p>
              The service may change, be limited, or be discontinued at any time
              without notice.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Contact</h2>
            <p>
              Questions: <a className='text-cyan-300 hover:text-cyan-200' href={siteConfig.author.url}>{siteConfig.author.name}</a>.
            </p>
          </section>
        </div>

        <Link href='/' className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'>
          ← Back to the downloader
        </Link>
      </div>
    </div>
  )
}
