import type { Metadata } from 'next'
import Link from 'next/link'
import { PlanChooser } from '@/components/PlanChooser'
import { Surface } from '@/components/Surface'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Pro',
  description:
    'A queue that runs a list of links unattended, bundled ZIP output, priority resolve, and no sponsor card. $3 a month, or $24 a year.',
  alternates: { canonical: '/pro' },
}

/**
 * Pro sells convenience over the same reach every visitor already has.
 *
 * Every entitlement here is a property of *this* site — how work is queued,
 * how results are packaged, how fast a resolver is tried, who answers your
 * email. None of them widen what a link can reach, and none of them involve
 * this site holding credentials on your behalf. That boundary is not
 * marketing: an entitlement on the other side of it is unsellable, because no
 * merchant of record will process payments for one.
 */
const features = [
  {
    title: 'A queue that runs itself',
    body: 'Paste a list instead of feeding links in one at a time, and let it work through them while you do something else. Free is the same queue with one link in it.',
  },
  {
    title: 'Bundled as one file',
    body: 'Images and audio from a run come back as a single ZIP rather than a folder of separate saves. Each video still saves on its own the moment it finishes.',
  },
  {
    title: 'Priority resolve',
    body: 'Your links go straight to the fastest resolver instead of walking the fallback chain. Free downloads are not throttled or queued — there is no rate limiter on this site — and this changes the order resolvers are tried, never the result you get.',
  },
  {
    title: 'A direct line to the developer',
    body: 'Ask for a feature and get a real answer from the person who builds this, not a support queue. Annual subscribers can also book a call — limited slots each month, so it stays a real conversation.',
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
          {/* Pick and buy in one place. A signed-out visitor's choice survives
              the trip through Google — see PlanChooser. */}
          <PlanChooser />

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
            you can already do gets taken away or put behind a paywall. Pro
            reaches exactly what a free visitor reaches — it never unlocks
            private, restricted, or login-only content, and you are responsible
            for having the rights to whatever you save.
          </p>

        </Surface>

        <p className='mt-6 text-center text-xs text-white/50'>
          This site trades as {siteConfig.seller}, and payments are processed by{' '}
          {siteConfig.merchantOfRecord}, who act as merchant of record &mdash; so
          your receipt and card statement show those names rather than{' '}
          {siteConfig.shortName}. Billing renews automatically each period;
          cancel any time from your account and Pro runs to the end of the
          period you paid for. Not for you? Email us within 14 days of any
          charge for a full refund. See the{' '}
          <Link href='/terms' className='text-cyan-300 hover:text-cyan-200'>
            Terms
          </Link>
          . Questions, billing problems or cancellations:{' '}
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
      </div>
    </div>
  )
}
