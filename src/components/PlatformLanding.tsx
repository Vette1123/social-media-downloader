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

const howItWorksSteps = [
  { n: 1, title: 'Copy a video URL', sub: 'TikTok, X, Instagram, Facebook, or YouTube' },
  { n: 2, title: 'Paste & process', sub: 'We resolve the media in seconds' },
  { n: 3, title: 'Download', sub: 'Video, MP3, or full image gallery' },
] as const

const trustStrip = [
  { k: 'Free', v: 'forever' },
  { k: 'No login', v: 'required' },
  { k: 'No limit', v: 'on downloads' },
] as const

function SectionHeading({ children }: { children: React.ReactNode }) {
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

function HowItWorks() {
  return (
    <div
      className='animate-fade-in-up rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5'
      style={{ animationDelay: '150ms' }}
    >
      <SectionHeading>How it works</SectionHeading>
      <ol className='space-y-3'>
        {howItWorksSteps.map((s) => (
          <li
            key={s.n}
            id={`step-${s.n}`}
            className='flex items-start gap-3 scroll-mt-24'
          >
            <div className='btn-grad flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold'>
              {s.n}
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-medium leading-tight text-white'>
                {s.title}
              </p>
              <p className='mt-0.5 text-xs text-white/55'>{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function PlatformSidebar({ platform }: { platform: Platform }) {
  return (
    <div className='space-y-4'>
      <div
        className='animate-fade-in-up rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5'
        style={{ animationDelay: '150ms' }}
      >
        <SectionHeading>
          With this {platform.name} downloader you can
        </SectionHeading>
        <ul className='space-y-2 text-sm text-white/75'>
          {platform.featureList.map((f) => (
            <li key={f} className='flex items-start gap-2'>
              <CheckMark className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className='animate-fade-in-up rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5'
        style={{ animationDelay: '230ms' }}
      >
        <SectionHeading>Supported {platform.name} URL formats</SectionHeading>
        <ul className='grid grid-cols-1 gap-x-4 gap-y-1.5 font-mono text-[11px] text-white/60 md:text-xs'>
          {platform.urlExamples.map((u) => (
            <li key={u} className='truncate'>
              {u}
            </li>
          ))}
        </ul>
      </div>

      <div
        className='animate-fade-in-up grid grid-cols-3 gap-2'
        style={{ animationDelay: '310ms' }}
      >
        {trustStrip.map((b) => (
          <div
            key={b.k}
            className='rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center'
          >
            <p className='text-sm font-semibold text-grad'>{b.k}</p>
            <p className='mt-0.5 text-[10px] text-white/50 md:text-xs'>{b.v}</p>
          </div>
        ))}
      </div>
    </div>
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
      className='animate-fade-in-up mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4'
      style={{ animationDelay: '260ms' }}
    >
      <p className='mb-3 text-xs text-white/65 md:text-sm'>
        Also try our dedicated downloaders
      </p>
      <div className='flex flex-wrap gap-2'>
        <Link
          href='/'
          className='inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-cyan-400/40 hover:text-white md:text-sm'
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
              className='inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-cyan-400/40 hover:text-white md:text-sm'
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded ${useBrandTile ? tile : ''}`}
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
      </div>
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
    <div className='relative flex min-h-[100dvh] justify-center overflow-clip bg-[#08080a] px-4 py-6'>
      <InteractiveBackground />

      <GlowCard className='animate-card-enter relative z-10 my-auto w-full max-w-sm rounded-3xl p-4 shadow-2xl backdrop-blur-md md:max-w-2xl md:p-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'>
        <div className='animate-fade-in-up mb-6 text-center md:mb-8'>
          <PlatformIconRow activeSlug={platform.slug} />
          <Breadcrumb platform={platform} />
          <h1 className='mb-2 text-2xl font-extrabold tracking-tight text-white text-balance md:text-3xl lg:text-4xl'>
            {platform.h1}
          </h1>
          <p className='mx-auto mb-4 max-w-3xl text-sm text-white/70 md:text-base'>
            {platform.tagline}
          </p>
          <div className='flex justify-center items-stretch gap-2 sm:gap-3 max-w-md sm:max-w-none mx-auto'>
            {devLinks.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='group flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 sm:px-4 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 active:scale-95'
              >
                <Icon className='h-[18px] w-[18px] shrink-0 text-white/80 transition-colors duration-300 group-hover:text-cyan-300' />
                <span className='text-sm font-medium text-white/80 transition-colors duration-300 group-hover:text-white'>
                  {label}
                </span>
              </a>
            ))}
            <RafiqPromoCard />
          </div>
        </div>

        <DownloaderApp
          idleLeftSlot={<HowItWorks />}
          idleRightSlot={<PlatformSidebar platform={platform} />}
        />

        <CrossLinkNav activeSlug={platform.slug} />

        <section
          aria-labelledby='seo-heading'
          className='animate-fade-in-up mt-10 space-y-6 text-white/80'
          style={{ animationDelay: '300ms' }}
        >
          <div>
            <h2
              id='seo-heading'
              className='mb-3 text-xl font-bold text-white md:text-2xl'
            >
              Free {platform.brandLabel} — {platform.tagline}
            </h2>
            <p className='text-sm leading-relaxed md:text-base'>
              {platform.intro}
            </p>
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            {platform.cards.map((card) => (
              <article
                key={card.title}
                className='rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/30'
              >
                <h3 className='mb-2 font-semibold text-white'>{card.title}</h3>
                <p className='text-sm'>{card.body}</p>
              </article>
            ))}
          </div>

          <div>
            <h2 className='mb-3 text-xl font-bold text-white md:text-2xl'>
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

        <footer className='animate-fade-in-up mt-10 flex flex-col items-center justify-center gap-3 border-t border-white/[0.08] pt-6 text-sm text-white/60 sm:flex-row sm:gap-5'>
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
      </GlowCard>
    </div>
  )
}
