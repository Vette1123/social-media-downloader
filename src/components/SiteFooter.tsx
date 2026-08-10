import Link from 'next/link'
import { GitHubIcon, PortfolioIcon } from '@/components/icons'
import { PlayAppLinks } from '@/components/PlayAppLinks'
import { siteConfig } from '@/config/site'

/**
 * The one footer, shared by the home page and every platform landing page.
 *
 * It was two hand-maintained copies until the merchant-of-record review asked
 * for a reachable support address on the site: adding it twice is exactly how
 * one copy goes stale, and a support address that disagrees with the one filed
 * in the payment account is the single most common review rejection. Support
 * email, legal links and the affiliation disclaimer now land in one place, on
 * every page a reviewer can open.
 */
export function SiteFooter() {
  return (
    <footer className='mt-16 border-t border-white/[0.08] pt-8 text-sm text-white/60 sm:mt-24'>
      <div className='flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5'>
        <span>
          Built by{' '}
          <a
            href={siteConfig.author.url}
            target='_blank'
            rel='noopener noreferrer'
            className='font-medium text-cyan-300 underline underline-offset-2 transition-colors hover:text-cyan-200'
          >
            {siteConfig.author.name}
          </a>
        </span>
        <Divider />
        <a
          href={siteConfig.author.url}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 text-white/70 transition-colors hover:text-white'
        >
          <PortfolioIcon className='h-4 w-4' />
          Portfolio
        </a>
        <a
          href={siteConfig.links.github}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 text-white/70 transition-colors hover:text-white'
        >
          <GitHubIcon className='h-4 w-4' />
          GitHub
        </a>
        <Divider />
        <Link href='/privacy' className='transition-colors hover:text-white/80'>
          Privacy
        </Link>
        <Link href='/terms' className='transition-colors hover:text-white/80'>
          Terms
        </Link>
        <Link href='/pro' className='transition-colors hover:text-white/80'>
          Pro
        </Link>
        <a
          href={`mailto:${siteConfig.supportEmail}`}
          className='transition-colors hover:text-white/80'
        >
          Support
        </a>
        <a
          href='https://buymeacoffee.com/vetteotp'
          target='_blank'
          rel='noopener noreferrer'
          className='transition-colors hover:text-white/80'
        >
          Sponsor
        </a>
        <Divider />
        <PlayAppLinks />
      </div>

      {/* Both lines are review surface, not decoration: the address has to be
          readable as text (not only behind a "Support" link), and the
          disclaimer has to sit on the page carrying the platform logos, not
          only in /terms. */}
      <p className='mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-white/45'>
        Questions, billing or takedown notices:{' '}
        <a
          href={`mailto:${siteConfig.supportEmail}`}
          className='text-white/60 underline underline-offset-2 transition-colors hover:text-white/80'
        >
          {siteConfig.supportEmail}
        </a>
        . Pro is sold by {siteConfig.seller}; payments are processed by{' '}
        {siteConfig.merchantOfRecord} as merchant of record.
      </p>
      <p className='mx-auto mt-2 max-w-2xl text-center text-xs leading-relaxed text-white/45'>
        Public posts only. {siteConfig.name} is an independent tool, not
        affiliated with or endorsed by TikTok, X, Instagram, Facebook, YouTube,
        Pinterest, Reddit, Threads, Snapchat, Twitch or Vimeo; their names and
        logos belong to their owners and identify which links this tool accepts.
      </p>
    </footer>
  )
}

function Divider() {
  return (
    <span aria-hidden className='hidden text-white/20 sm:inline'>
      ·
    </span>
  )
}
