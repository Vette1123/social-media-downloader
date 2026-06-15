import Link from 'next/link'
import { DownloaderApp } from '@/components/DownloaderApp'
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
import { siteConfig } from '@/config/site'
import type { Platform, PlatformSlug } from '@/lib/platforms'
import { platforms } from '@/lib/platforms'

const devLinks = [
  {
    href: siteConfig.author.url,
    label: 'Portfolio',
    Icon: PortfolioIcon,
    grad: 'from-pink-500/80 to-violet-500/80',
  },
  {
    href: siteConfig.links.github,
    label: 'GitHub',
    Icon: GitHubIcon,
    grad: 'from-violet-500/80 to-cyan-400/80',
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
  {
    n: 1,
    title: 'Copy a video URL',
    sub: 'TikTok, X, Instagram, Facebook, or YouTube',
    grad: 'from-pink-500 to-pink-400',
  },
  {
    n: 2,
    title: 'Paste & process',
    sub: 'We resolve the media in seconds',
    grad: 'from-fuchsia-500 to-violet-500',
  },
  {
    n: 3,
    title: 'Download',
    sub: 'Video, MP3, or full image gallery',
    grad: 'from-violet-500 to-cyan-400',
  },
] as const

const trustStrip = [
  { k: 'Free', v: 'forever', accent: 'text-emerald-300' },
  { k: 'No login', v: 'required', accent: 'text-sky-300' },
  { k: 'No limit', v: 'on downloads', accent: 'text-pink-300' },
] as const

function HowItWorks() {
  return (
    <div
      className='animate-fade-in-up bg-white/5 rounded-xl p-5 border border-white/10'
      style={{ animationDelay: '150ms' }}
    >
      <h3 className='text-white font-semibold mb-4 text-sm md:text-base flex items-center'>
        🚀 How it works
        <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded' />
      </h3>
      <ol className='space-y-3'>
        {howItWorksSteps.map((s) => (
          <li
            key={s.n}
            id={`step-${s.n}`}
            className='flex items-start gap-3 group scroll-mt-24'
          >
            <div
              className={`shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${s.grad} flex items-center justify-center text-white text-xs font-bold shadow-md ring-1 ring-white/20`}
            >
              {s.n}
            </div>
            <div className='min-w-0'>
              <p className='text-white text-sm font-medium leading-tight'>
                {s.title}
              </p>
              <p className='text-white/55 text-xs mt-0.5'>{s.sub}</p>
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
        className='animate-fade-in-up bg-white/5 rounded-xl p-5 border border-white/10'
        style={{ animationDelay: '150ms' }}
      >
        <h3 className='text-white font-semibold mb-3 text-sm md:text-base flex items-center'>
          ✨ With this {platform.name} downloader you can
          <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded' />
        </h3>
        <ul className='space-y-2 text-sm text-white/75'>
          {platform.featureList.map((f) => (
            <li key={f} className='flex items-start gap-2'>
              <span
                aria-hidden
                className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r ${platform.accent.grad}`}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className='animate-fade-in-up bg-white/5 rounded-xl p-5 border border-white/10'
        style={{ animationDelay: '230ms' }}
      >
        <h3 className='text-white font-semibold mb-3 text-sm md:text-base flex items-center'>
          🔗 Supported {platform.name} URL formats
          <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-cyan-400 to-sky-500 rounded' />
        </h3>
        <ul className='grid grid-cols-1 gap-x-4 gap-y-1.5 text-[11px] md:text-xs text-white/65 font-mono'>
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
            className='bg-white/5 rounded-lg p-3 border border-white/10 text-center'
          >
            <p className={`text-sm font-semibold ${b.accent}`}>{b.k}</p>
            <p className='text-white/50 text-[10px] md:text-xs mt-0.5'>{b.v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlatformIconRow({ activeSlug }: { activeSlug: PlatformSlug }) {
  return (
    <div className='flex justify-center mb-4'>
      <div className='flex items-center gap-2 md:gap-2.5'>
        {platforms.map((p) => {
          const { Icon, tile } = platformIcons[p.slug]
          const isActive = p.slug === activeSlug
          const ring = isActive
            ? 'ring-2 ring-white/80 shadow-pink-500/40'
            : 'ring-1 ring-white/15 hover:ring-white/35'
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
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${tile} flex items-center justify-center ${ring} ${opacity} shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5`}
              >
                {tile.startsWith('bg-transparent') ? (
                  <Icon className='w-full h-full' />
                ) : (
                  <Icon className='w-5 h-5 md:w-6 md:h-6 text-white' />
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
      className='animate-fade-in-up mt-8 rounded-xl bg-white/5 border border-white/10 p-4'
      style={{ animationDelay: '260ms' }}
    >
      <p className='text-white/65 text-xs md:text-sm mb-3'>
        Also try our dedicated downloaders
      </p>
      <div className='flex flex-wrap gap-2'>
        <Link
          href='/'
          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/80 hover:text-white hover:border-white/40 text-xs md:text-sm transition-colors'
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
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/80 hover:text-white hover:border-white/40 text-xs md:text-sm transition-colors'
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded ${useBrandTile ? tile : ''}`}
              >
                {useBrandTile ? (
                  <Icon className='w-3.5 h-3.5 text-white' />
                ) : (
                  <Icon className='w-full h-full' />
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
      className='flex justify-center mb-3 text-[11px] md:text-xs text-white/55'
    >
      <ol className='flex items-center gap-1.5'>
        <li>
          <Link href='/' className='hover:text-white/85 transition-colors'>
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
    <div className='relative min-h-screen overflow-clip bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex justify-center items-start py-6 px-4'>
      <div
        aria-hidden
        className='blob-1 pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pink-500/30 blur-3xl'
      />
      <div
        aria-hidden
        className='blob-2 pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-cyan-400/25 blur-3xl'
      />
      <div
        aria-hidden
        className='blob-3 pointer-events-none absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl'
      />

      <div className='animate-card-enter relative z-10 my-auto w-full max-w-sm md:max-w-2xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-8 shadow-2xl border border-white/20'>
        <div className='animate-fade-in-up text-center mb-6 md:mb-8'>
          <PlatformIconRow activeSlug={platform.slug} />
          <Breadcrumb platform={platform} />
          <h1 className='text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2'>
            {platform.h1}
          </h1>
          <p className='text-sm md:text-base text-white/70 mb-4 max-w-3xl mx-auto'>
            {platform.tagline}
          </p>
          <div className='flex justify-center items-center gap-3'>
            {devLinks.map(({ href, label, Icon, grad }) => (
              <a
                key={label}
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/15 overflow-hidden backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
              >
                <span
                  className={`absolute inset-0 bg-gradient-to-r ${grad} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  aria-hidden
                />
                <span
                  className='pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-white/30 transition-all duration-300'
                  aria-hidden
                />
                <Icon className='relative w-4 h-4 text-white/80 group-hover:text-white transition-colors duration-300' />
                <span className='relative text-white/80 group-hover:text-white text-sm font-medium transition-colors duration-300'>
                  {label}
                </span>
              </a>
            ))}
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
              className='text-xl md:text-2xl font-bold text-white mb-3'
            >
              Free {platform.brandLabel} — {platform.tagline}
            </h2>
            <p className='text-sm md:text-base leading-relaxed'>
              {platform.intro}
            </p>
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            {platform.cards.map((card) => (
              <article
                key={card.title}
                className='bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/30 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02]'
              >
                <h3 className='text-white font-semibold mb-2'>{card.title}</h3>
                <p className='text-sm'>{card.body}</p>
              </article>
            ))}
          </div>

          <div>
            <h2 className='text-xl md:text-2xl font-bold text-white mb-3'>
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

        <footer className='animate-fade-in-up mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-sm text-white/60'>
          <span>
            Built by{' '}
            <a
              href={siteConfig.author.url}
              target='_blank'
              rel='noopener noreferrer'
              className='font-medium text-pink-300 hover:text-pink-200 underline underline-offset-2 transition-colors'
            >
              {siteConfig.author.name}
            </a>
          </span>
          <span aria-hidden className='hidden sm:inline text-white/20'>
            •
          </span>
          <a
            href={siteConfig.author.url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors'
          >
            <PortfolioIcon className='w-4 h-4' />
            Portfolio
          </a>
          <a
            href={siteConfig.links.github}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors'
          >
            <GitHubIcon className='w-4 h-4' />
            GitHub
          </a>
        </footer>
      </div>
    </div>
  )
}
