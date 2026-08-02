import type { Metadata } from 'next'
import Link from 'next/link'
import { ProCtaPanel } from '@/components/ProCtaPanel'
import { Surface } from '@/components/Surface'
import { PRO_PRICE_ANNUAL, PRO_PRICE_MONTHLY } from '@/config/pro'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Pro',
  description:
    'Priority resolve, batch downloads, no sponsor card, and Instagram login-gated posts when a session cookie is configured. $3 a month, or $24 a year.',
  alternates: { canonical: '/pro' },
}

const features = [
  {
    title: 'Priority resolve',
    body: 'Your links go straight to the fastest resolver instead of walking the fallback chain. Free downloads are not throttled or queued (there is no rate limiter on this site); this only changes which resolver a Pro link tries first.',
  },
  {
    title: 'Batch, up to 20 links',
    body: 'Paste up to 20 links at once and resolve them as a queue. Images and audio come back bundled into one ZIP; each video saves on its own as soon as it finishes.',
  },
  {
    title: 'No sponsor card',
    body: 'Removes the one sponsor card that can appear after a download finishes, site-wide. It is the only paid placement here.',
  },
  {
    title: 'Login-gated Instagram posts',
    body: 'Resolves login-gated Instagram posts when a working session cookie is configured on our end. Public Instagram content is free for everyone and always has been. This only reaches the private, login-gated posts free requests already could not, and only when that cookie is set up.',
  },
  {
    title: 'Ask for features',
    body: 'Pro subscribers can request features and get a real answer from the person who builds this, not a support queue.',
  },
  {
    title: 'Talk to the developer',
    body: 'Annual subscribers can book a call. Limited slots each month, so it stays a real conversation.',
  },
] as const

export default function Pro() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <div className='text-center'>
          <span className='btn-grad inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
            Pro
          </span>
          <h1 className='mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl'>
            One account. <span className='text-grad'>Every device.</span>
          </h1>
          <p className='mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base'>
            $3 a month, or $24 a year. Sign in with Google — no password to
            remember, and the downloader stays exactly as free as it is today
            either way.
          </p>
        </div>

        <Surface
          glow
          radius='3xl'
          className='animate-card-enter mt-8 p-5 shadow-2xl sm:p-8'
        >
          <div className='grid gap-3 sm:grid-cols-2'>
            <Surface elevation='raised' className='relative p-5 text-center'>
              <span className='btn-grad absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
                Best value
              </span>
              <p className='mt-2 text-3xl font-extrabold text-white'>
                {PRO_PRICE_ANNUAL}
                <span className='text-base font-medium text-white/50'>/year</span>
              </p>
              <p className='mt-1 text-xs text-white/50'>Two months free versus paying monthly</p>
            </Surface>
            <Surface elevation='raised' className='p-5 text-center'>
              <p className='mt-2 text-3xl font-extrabold text-white'>
                {PRO_PRICE_MONTHLY}
                <span className='text-base font-medium text-white/50'>/month</span>
              </p>
              <p className='mt-1 text-xs text-white/50'>Cancel any time</p>
            </Surface>
          </div>

          <p className='mt-4 text-center text-sm text-white/60'>
            Signed in on up to 5 devices at once, so it covers a few of your
            own devices and browsers.
          </p>

          <ul className='mt-8 grid gap-3 sm:grid-cols-2'>
            {features.map((f) => (
              <Surface
                key={f.title}
                as='li'
                elevation='raised'
                interaction='lift'
                className='p-4'
              >
                <p className='font-semibold text-white'>{f.title}</p>
                <p className='mt-1 text-sm leading-relaxed text-white/60'>{f.body}</p>
              </Surface>
            ))}
          </ul>

          <p className='mt-6 text-center text-sm text-white/60'>
            Everything that is free today stays free. Pro only adds, and nothing
            you can already do gets taken away or put behind a paywall.
          </p>

          <div className='mt-8'>
            <ProCtaPanel />
          </div>
        </Surface>

        <p className='mt-6 text-center text-xs text-white/40'>
          Payments are processed by Lemon Squeezy, who act as merchant of
          record. Billing renews automatically each period; cancel any time
          from your account. See the{' '}
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
          Back to the downloader
        </Link>
      </div>
    </div>
  )
}
