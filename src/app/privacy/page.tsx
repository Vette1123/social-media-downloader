import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} handles your data: no accounts, no download logs, no cross-site tracking.`,
  alternates: { canonical: '/privacy' },
}

const UPDATED = '31 July 2026'

export default function Privacy() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <h1 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          Privacy Policy
        </h1>
        <p className='mt-2 text-sm text-white/50'>Last updated {UPDATED}</p>

        <div className='mt-8 space-y-6 text-sm leading-relaxed text-white/70 md:text-base'>
          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>What we collect</h2>
            <p>
              No accounts, no sign-up, no email address. We do not log the links
              you paste or the files you download. Your Recent list is written to
              your own browser&rsquo;s local storage and never leaves the device.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Analytics</h2>
            <p>
              We use Cloudflare Web Analytics for page-view counts. It sets no
              cookies, builds no cross-site profile, and does not fingerprint
              your device. That is the only analytics on this site.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Sponsor links</h2>
            <p>
              After a successful download we may show one sponsor card. If you
              click it you are taken to that company&rsquo;s own site and we may
              earn a commission on a purchase, at no extra cost to you. We only
              see that a click happened, reported in aggregate by the advertiser.
              We never sell your data, and we run no popups, popunders, or
              redirects.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Payments</h2>
            <p>
              If you buy a Pro license, the payment is processed by Lemon
              Squeezy, who act as merchant of record. We never see your card
              details. Your license key is stored in your own browser.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Media handling</h2>
            <p>
              Links are resolved on demand and nothing you download is stored on
              our servers. Where a file is proxied, it is streamed through and
              discarded.
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
