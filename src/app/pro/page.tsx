import type { Metadata } from 'next'
import Link from 'next/link'
import { GlowCard } from '@/components/GlowCard'
import { ProLicensePanel } from '@/components/ProLicensePanel'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Pro',
  description:
    'A $9 one-time license: priority resolve, batch downloads, no sponsor card, and Instagram login-gated posts when a session cookie is configured. No account, no subscription.',
  alternates: { canonical: '/pro' },
}

// TEMPLATE — the Lemon Squeezy store does not exist yet. Replace this with
// the real hosted-checkout URL before launch. Until then the buy button below
// stays visibly disabled rather than link somewhere broken or fake-looking.
const CHECKOUT_URL = 'TEMPLATE_LEMONSQUEEZY_CHECKOUT_URL'

function isCheckoutConfigured(url: string): boolean {
  return url.startsWith('https://')
}

const features = [
  {
    title: 'Priority resolve',
    body: 'Your links go straight to the fastest resolver instead of walking the fallback chain. Free downloads are not throttled or queued — there is no rate limiter on this site — this only changes which resolver a Pro link tries first.',
  },
  {
    title: 'Batch, up to 20 links',
    body: 'Paste up to 20 links at once and resolve them as a queue. Images and audio come back bundled into one ZIP; each video saves on its own as soon as it finishes.',
  },
  {
    title: 'No sponsor card',
    body: 'Removes the one sponsor card that can appear after a download finishes, site-wide — the only paid placement on this site.',
  },
  {
    title: 'Login-gated Instagram posts',
    body: 'Resolves login-gated Instagram posts when a working session cookie is configured on our end. Public Instagram content is free for everyone and always has been — this only reaches the private, login-gated posts free requests already could not, and only when that cookie is set up.',
  },
] as const

export default function Pro() {
  const checkoutReady = isCheckoutConfigured(CHECKOUT_URL)

  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <div className='text-center'>
          <span className='btn-grad inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
            Pro
          </span>
          <h1 className='mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl'>
            One key. <span className='text-grad'>Lifetime.</span>
          </h1>
          <p className='mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base'>
            $9, one time. No subscription, no renewal, no account — the
            downloader stays exactly as free as it is today either way.
          </p>
        </div>

        <GlowCard className='animate-card-enter mt-8 rounded-3xl p-5 shadow-2xl sm:p-8'>
          <div className='flex flex-col items-center gap-3 text-center'>
            <p className='text-4xl font-extrabold text-white'>
              $9 <span className='text-base font-medium text-white/50'>one-time</span>
            </p>
            <p className='text-sm text-white/60'>
              Lifetime access for one license key. Up to 3 activations, so it
              covers a couple of your own devices.
            </p>
            {checkoutReady ? (
              <a
                href={CHECKOUT_URL}
                className='btn-grad mt-2 inline-flex rounded-xl px-6 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
              >
                Buy Pro — $9
              </a>
            ) : (
              <button
                type='button'
                disabled
                title='Checkout is not set up yet'
                className='mt-2 inline-flex cursor-not-allowed rounded-xl bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white/40 ring-1 ring-white/10'
              >
                Checkout coming soon
              </button>
            )}
          </div>

          <ul className='mt-8 grid gap-3 sm:grid-cols-2'>
            {features.map((f) => (
              <li
                key={f.title}
                className='card-lift rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4'
              >
                <p className='font-semibold text-white'>{f.title}</p>
                <p className='mt-1 text-sm leading-relaxed text-white/60'>{f.body}</p>
              </li>
            ))}
          </ul>

          <p className='mt-6 text-center text-sm text-white/60'>
            Everything that is free today stays free. Pro only adds — nothing
            you can already do gets taken away or put behind a paywall.
          </p>

          <div className='mt-8'>
            <ProLicensePanel />
          </div>
        </GlowCard>

        <p className='mt-6 text-center text-xs text-white/40'>
          Payments are processed by Lemon Squeezy, who act as merchant of
          record. Refundable within 14 days — see the{' '}
          <Link href='/terms' className='text-cyan-300 hover:text-cyan-200'>
            Terms
          </Link>
          . Questions:{' '}
          <a className='text-cyan-300 hover:text-cyan-200' href={siteConfig.author.url}>
            {siteConfig.author.name}
          </a>
          .
        </p>

        <Link href='/' className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'>
          ← Back to the downloader
        </Link>
      </div>
    </div>
  )
}
