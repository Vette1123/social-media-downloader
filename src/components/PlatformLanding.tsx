import Link from 'next/link'
import { DownloaderApp } from '@/components/DownloaderApp'
import { GlowCard } from '@/components/GlowCard'
import { InteractiveBackground } from '@/components/InteractiveBackground'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  PortfolioIcon,
  TikTokIcon,
  TwitterXIcon,
  YouTubeIcon,
} from '@/components/icons'
import { RafiqLink } from '@/components/RafiqLink'
import { RafiqPromoCard } from '@/components/RafiqPromoCard'
import { siteConfig } from '@/config/site'
import type { Platform, PlatformSlug } from '@/lib/platforms'
import { platforms } from '@/lib/platforms'

const devLinks = [
  {
    href: siteConfig.author.url,
    label: 'Portfolio',
    Icon: PortfolioIcon,
  },
  {
    href: siteConfig.links.github,
    label: 'GitHub',
    Icon: GitHubIcon,
  },
] as const

const heroChips = [
  'Free forever',
  'No login required',
  'No download limits',
  'HD quality',
] as const

const platformIcons: Record<PlatformSlug, { Icon: React.ComponentType<{ className?: string }>; tile: string }> = {
  'tiktok-downloader': {
    Icon: TikTokIcon,
    tile: 'bg-[#010101]',
  },
  'twitter-video-downloader': {
    Icon: TwitterXIcon,
    tile: 'bg-black',
  },
  'instagram-downloader': {
    Icon: InstagramIcon,
    tile: 'bg-transparent overflow-hidden',
  },
  'facebook-downloader': {
    Icon: FacebookIcon,
    tile: 'bg-transparent overflow-hidden',
  },
  'youtube-downloader': {
    Icon: YouTubeIcon,
    tile: 'bg-transparent overflow-hidden',
  },
}

// Centered section header (title + one-line sub) for the full-width bands.
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className='mx-auto mb-9 max-w-2xl text-center'>
      <h2 className='text-2xl font-bold tracking-tight text-white text-balance sm:text-3xl'>
        {title}
      </h2>
      {sub && <p className='mt-3 text-sm text-white/60 md:text-base'>{sub}</p>}
    </div>
  )
}

// Uppercase eyebrow with a fading cyan hairline — for in-column labels.
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.13em] uppercase text-white/60'>
      {children}
      <span className='h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent' />
    </h3>
  )
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round'>
      <path d='m5 12 5 5 9-11' />
    </svg>
  )
}

function PlatformIconRow({ activeSlug }: { activeSlug: PlatformSlug }) {
  return (
    <div className='mb-4 flex justify-center'>
      <div className='flex items-center gap-2 md:gap-2.5'>
        {platforms.map((p) => {
          const { Icon, tile } = platformIcons[p.slug]
          const isActive = p.slug === activeSlug
          const ring = isActive
            ? 'ring-2 ring-cyan-400/80'
            : 'ring-1 ring-white/15 hover:ring-cyan-400/40'
          const opacity = isActive ? '' : 'opacity-80 hover:opacity-100'
          return (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              aria-label={`${p.brandLabel}${isActive ? ' (current page)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              className='block'
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl md:h-12 md:w-12 ${tile} ${ring} ${opacity} shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5`}
              >
                {tile.startsWith('bg-transparent') ? (
                  <Icon className='h-full w-full' />
                ) : (
                  <Icon className='h-5 w-5 text-white md:h-6 md:w-6' />
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function CrossLinkNav({ activeSlug }: { activeSlug: PlatformSlug }) {
  const others = platforms.filter((p) => p.slug !== activeSlug)
  return (
    <nav
      aria-label='Other downloaders'
      className='flex flex-wrap justify-center gap-2.5'
    >
      <Link
        href='/'
        className='inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:text-white'
      >
        ← All platforms
      </Link>
      {others.map((p) => {
        const { Icon, tile } = platformIcons[p.slug]
        const useBrandTile = !tile.startsWith('bg-transparent')
        return (
          <Link
            key={p.slug}
            href={`/${p.slug}`}
            className='inline-flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:text-white'
          >
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${useBrandTile ? tile : ''}`}
            >
              {useBrandTile ? (
                <Icon className='h-3.5 w-3.5 text-white' />
              ) : (
                <Icon className='h-full w-full' />
              )}
            </span>
            {p.brandLabel}
          </Link>
        )
      })}
    </nav>
  )
}

function Breadcrumb({ platform }: { platform: Platform }) {
  return (
    <nav
      aria-label='Breadcrumb'
      className='mb-3 flex justify-center text-[11px] text-white/55 md:text-xs'
    >
      <ol className='flex items-center gap-1.5'>
        <li>
          <Link href='/' className='transition-colors hover:text-white/85'>
            Home
          </Link>
        </li>
        <li aria-hidden className='text-white/30'>
          /
        </li>
        <li aria-current='page' className='text-white/85'>
          {platform.brandLabel}
        </li>
      </ol>
    </nav>
  )
}

export function PlatformLanding({ platform }: { platform: Platform }) {
  return (
    <div className='relative min-h-[100dvh] overflow-clip bg-[#08080a]'>
      {/* Fixed so the interactive grid + spotlight track the viewport across
          the full scroll length of the page. */}
      <div className='pointer-events-none fixed inset-0 z-0'>
        <InteractiveBackground />
      </div>

      <div className='relative z-10 mx-auto max-w-6xl px-4 py-10 sm:py-16'>
        {/* HERO — brand row, breadcrumb, headline, and the paste-bar. */}
        <GlowCard className='animate-card-enter mx-auto w-full max-w-3xl rounded-3xl p-5 shadow-2xl sm:p-8 md:p-10'>
          <div className='animate-fade-in-up text-center'>
            <PlatformIconRow activeSlug={platform.slug} />
            <Breadcrumb platform={platform} />
            <h1 className='mb-3 text-2xl font-extrabold tracking-tight text-white text-balance sm:text-3xl md:text-4xl'>
              {platform.h1}
            </h1>
            <p className='mx-auto mb-7 max-w-xl text-sm text-white/70 md:text-base'>
              {platform.tagline}
            </p>
          </div>

          {/* Interactive island — paste bar + results */}
          <DownloaderApp />

          {/* Reassurance chips */}
          <div className='mt-7 flex flex-wrap justify-center gap-2'>
            {heroChips.map((chip) => (
              <span
                key={chip}
                className='inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70 md:text-sm'
              >
                <span className='h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]' />
                {chip}
              </span>
            ))}
          </div>

          {/* Dev / companion-app links */}
          <div className='mx-auto mt-6 flex max-w-md items-stretch justify-center gap-2 sm:max-w-none sm:gap-3'>
            {devLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='group flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 active:scale-95 sm:flex-none sm:px-4'
              >
                <Icon className='h-[18px] w-[18px] shrink-0 text-white/80 transition-colors duration-300 group-hover:text-cyan-300' />
                <span className='text-sm font-medium text-white/80 transition-colors duration-300 group-hover:text-white'>
                  {label}
                </span>
              </a>
            ))}
            <RafiqPromoCard />
          </div>
        </GlowCard>

        {/* WHAT YOU CAN DO — platform feature list */}
        <section className='mt-16 sm:mt-24'>
          <SectionHead title={`With this ${platform.name} downloader you can`} />
          <ul className='mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2'>
            {platform.featureList.map((f) => (
              <li
                key={f}
                className='flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/80'
              >
                <CheckMark className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* HIGHLIGHT CARDS */}
        <section className='mt-16 sm:mt-24'>
          <div className='grid gap-4 md:grid-cols-3'>
            {platform.cards.map((card) => (
              <article
                key={card.title}
                className='rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/30'
              >
                <h3 className='mb-2 font-semibold text-white'>{card.title}</h3>
                <p className='text-sm text-white/75'>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CROSS-LINKS */}
        <section className='mt-16 sm:mt-24'>
          <SectionHead
            title='Also try our other downloaders'
            sub='One tool per platform — pick whichever you need.'
          />
          <CrossLinkNav activeSlug={platform.slug} />
        </section>

        {/* SEO PROSE + FAQ */}
        <section
          aria-labelledby='seo-heading'
          className='mt-16 grid gap-10 sm:mt-24 lg:grid-cols-2 lg:gap-14'
        >
          <div>
            <Eyebrow>Why it works</Eyebrow>
            <h2
              id='seo-heading'
              className='mb-4 text-2xl font-bold tracking-tight text-white text-balance md:text-3xl'
            >
              Free {platform.brandLabel} — {platform.tagline}
            </h2>
            <p className='mb-8 max-w-[60ch] text-sm leading-relaxed text-white/80 md:text-base'>
              {platform.intro}
            </p>

            <Eyebrow>Supported {platform.name} URL formats</Eyebrow>
            <ul className='grid grid-cols-1 gap-x-6 gap-y-1.5 font-mono text-[11px] text-white/55 sm:grid-cols-2 md:text-xs'>
              {platform.urlExamples.map((u) => (
                <li key={u} className='truncate'>
                  {u}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className='mb-5 text-2xl font-bold tracking-tight text-white md:text-3xl'>
              {platform.name} downloader — Frequently asked questions
            </h2>
            <Accordion
              type='single'
              collapsible
              defaultValue='faq-1'
              className='space-y-3'
            >
              {platform.faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i + 1}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Footer */}
        <footer className='mt-16 flex flex-col items-center justify-center gap-3 border-t border-white/[0.08] pt-8 text-sm text-white/60 sm:mt-24 sm:flex-row sm:gap-5'>
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
          <span aria-hidden className='hidden text-white/20 sm:inline'>
            ·
          </span>
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
          <span aria-hidden className='hidden sm:inline text-white/20'>
            •
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <RafiqLink />
            <span className='text-white/40'>— an app made by us</span>
          </span>
        </footer>
      </div>
    </div>
  )
}
