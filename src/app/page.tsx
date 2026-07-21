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
import { platforms } from '@/lib/platforms'
import { homepageStructuredData } from '@/lib/structuredData'

const devLinks = [
  {
    href: 'https://www.mohamedgado.com/',
    label: 'Portfolio',
    Icon: PortfolioIcon,
  },
  {
    href: 'https://github.com/Vette1123/social-media-downloader',
    label: 'GitHub',
    Icon: GitHubIcon,
  },
] as const

const howItWorksSteps = [
  {
    n: 1,
    title: 'Copy a video URL',
    sub: 'TikTok, X, Instagram, Facebook, or YouTube',
  },
  {
    n: 2,
    title: 'Paste & process',
    sub: 'We resolve the media in seconds',
  },
  {
    n: 3,
    title: 'Download',
    sub: 'Video, MP3, or full image gallery',
  },
] as const

// Line icons for the "what you can do" grid — replaces the old emoji glyphs.
function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round'>
      <path d='m10 8 6 4-6 4V8z' />
      <rect x='3' y='4' width='18' height='16' rx='3' />
    </svg>
  )
}
function IconAudio({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M9 18V6l10-2v12' />
      <circle cx='6' cy='18' r='3' />
      <circle cx='16' cy='16' r='3' />
    </svg>
  )
}
function IconGallery({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='3' width='18' height='18' rx='3' />
      <circle cx='9' cy='9' r='2' />
      <path d='m21 15-5-5L5 21' />
    </svg>
  )
}
function IconZip({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 8v13H3V8' />
      <rect x='1' y='3' width='22' height='5' rx='1' />
      <path d='M10 12h4' />
    </svg>
  )
}

const whatYouCanDo = [
  { Icon: IconVideo, label: 'HD Video', sub: 'No watermark' },
  { Icon: IconAudio, label: 'MP3 audio', sub: 'Extract soundtrack' },
  { Icon: IconGallery, label: 'Slideshow', sub: 'Image carousels' },
  { Icon: IconZip, label: 'Batch ZIP', sub: 'All images at once' },
] as const

const trustStrip = [
  { k: 'Free', v: 'forever' },
  { k: 'No login', v: 'required' },
  { k: 'No limit', v: 'on downloads' },
] as const

const mobileFeatures = [
  'Watermark-free downloads',
  'HD quality preservation',
  'MP3 audio extraction',
  'Video preview',
  'Image gallery downloads',
  'Multiple URL formats',
  'Batch image selection',
  'Fast processing',
] as const

const seoCards = [
  {
    title: 'Videos in HD',
    body: 'Watermark-free TikTok downloads plus native Twitter/X, Facebook, and YouTube (including Shorts) video rips, served with proper range requests so preview and seeking work flawlessly.',
  },
  {
    title: 'MP3 audio extraction',
    body: 'Pull the soundtrack from any TikTok video or slideshow. Photo carousels keep the original background music — perfect for trending sounds.',
  },
  {
    title: 'Photo carousels',
    body: 'TikTok slideshows come through as a full-resolution gallery. Preview, pick favorites, then save individually or as a single ZIP.',
  },
] as const

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.13em] uppercase text-white/60'>
      {children}
      <span className='h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent' />
    </h3>
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

function IdleRightContent() {
  return (
    <div className='space-y-4'>
      {/* What you can do — 2x2 grid */}
      <div
        className='animate-fade-in-up rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5'
        style={{ animationDelay: '150ms' }}
      >
        <SectionHeading>What you can do</SectionHeading>
        <div className='grid grid-cols-2 gap-3'>
          {whatYouCanDo.map((t) => (
            <div
              key={t.label}
              className='group rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/30'
            >
              <t.Icon className='mb-2 h-6 w-6 text-cyan-300 drop-shadow-[0_2px_6px_rgba(34,211,238,0.35)]' />
              <p className='text-sm font-semibold leading-tight text-white'>
                {t.label}
              </p>
              <p className='mt-0.5 text-xs text-white/55'>{t.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported link formats */}
      <div
        className='animate-fade-in-up rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5'
        style={{ animationDelay: '230ms' }}
      >
        <SectionHeading>Supported link formats</SectionHeading>
        <ul className='grid grid-cols-1 gap-x-4 gap-y-1.5 font-mono text-[11px] text-white/60 sm:grid-cols-2 md:text-xs'>
          <li className='truncate'>tiktok.com/@user/video/…</li>
          <li className='truncate'>vm.tiktok.com/…</li>
          <li className='truncate'>x.com/user/status/…</li>
          <li className='truncate'>instagram.com/p/…</li>
          <li className='truncate'>instagram.com/reel/…</li>
          <li className='truncate'>youtube.com/watch?v=…</li>
          <li className='truncate'>youtu.be/… · /shorts/…</li>
          <li className='truncate'>facebook.com/…/videos/…</li>
          <li className='truncate'>fb.watch/… · /reel/…</li>
        </ul>
      </div>

      {/* Trust strip */}
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

const platformLinkTiles: Record<
  string,
  { tile: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  'tiktok-downloader': { tile: 'bg-[#010101]', Icon: TikTokIcon },
  'twitter-video-downloader': { tile: 'bg-black', Icon: TwitterXIcon },
  'instagram-downloader': { tile: 'bg-transparent', Icon: InstagramIcon },
  'facebook-downloader': { tile: 'bg-transparent', Icon: FacebookIcon },
  'youtube-downloader': { tile: 'bg-transparent', Icon: YouTubeIcon },
}

function PlatformLinks() {
  return (
    <nav
      aria-label='Per-platform downloaders'
      className='animate-fade-in-up mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4'
      style={{ animationDelay: '260ms' }}
    >
      <p className='mb-3 text-xs text-white/65 md:text-sm'>
        Or jump straight to a dedicated downloader
      </p>
      <div className='flex flex-wrap gap-2'>
        {platforms.map((p) => {
          const cfg = platformLinkTiles[p.slug]
          if (!cfg) return null
          const { tile, Icon } = cfg
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

export default function Home() {
  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageStructuredData()),
        }}
      />
      <div className='relative flex min-h-[100dvh] justify-center overflow-clip bg-[#08080a] px-4 py-6'>
        <InteractiveBackground />

        <GlowCard className='animate-card-enter relative z-10 my-auto w-full max-w-sm rounded-3xl p-4 shadow-2xl backdrop-blur-md md:max-w-2xl md:p-8 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'>
          {/* Header */}
          <div className='animate-fade-in-up mb-6 text-center md:mb-8'>
            <div className='mb-4 flex justify-center'>
              <div className='flex items-center gap-2 md:gap-2.5'>
                <Link
                  href='/tiktok-downloader'
                  aria-label='TikTok video downloader'
                  className='block'
                >
                  <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-[#010101] ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12'>
                    <TikTokIcon className='h-5 w-5 text-white md:h-6 md:w-6' />
                  </span>
                </Link>
                <Link
                  href='/twitter-video-downloader'
                  aria-label='Twitter/X video downloader'
                  className='block'
                >
                  <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-black ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12'>
                    <TwitterXIcon className='h-5 w-5 text-white md:h-6 md:w-6' />
                  </span>
                </Link>
                <Link
                  href='/instagram-downloader'
                  aria-label='Instagram reels & photo downloader'
                  className='block'
                >
                  <span className='flex h-10 w-10 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12'>
                    <InstagramIcon className='h-full w-full' />
                  </span>
                </Link>
                <Link
                  href='/facebook-downloader'
                  aria-label='Facebook video & reels downloader'
                  className='block'
                >
                  <span className='flex h-10 w-10 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12'>
                    <FacebookIcon className='h-full w-full' />
                  </span>
                </Link>
                <Link
                  href='/youtube-downloader'
                  aria-label='YouTube & Shorts downloader'
                  className='block'
                >
                  <span className='flex h-10 w-10 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12'>
                    <YouTubeIcon className='h-full w-full' />
                  </span>
                </Link>
              </div>
            </div>
            <h1 className='mb-2 text-3xl font-extrabold tracking-tight text-white text-balance md:text-4xl lg:text-5xl'>
              Download any video, <span className='text-grad'>watermark-free</span>
            </h1>
            <p className='mx-auto mb-4 max-w-2xl text-sm text-white/70 md:text-base'>
              Save videos without watermarks, extract MP3 audio, or grab images
              from TikTok, X, Instagram, Facebook &amp; YouTube
            </p>
            <div className='mx-auto flex max-w-md items-stretch justify-center gap-2 sm:max-w-none sm:gap-3'>
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
          </div>

          {/* Interactive island — form + results */}
          <DownloaderApp
            idleLeftSlot={<HowItWorks />}
            idleRightSlot={<IdleRightContent />}
          />

          <PlatformLinks />

          {/* Features List - Mobile only */}
          <div
            className='animate-fade-in-up mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 lg:hidden'
            style={{ animationDelay: '200ms' }}
          >
            <SectionHeading>Features</SectionHeading>
            <div className='grid grid-cols-1 gap-3 text-xs md:grid-cols-2 md:text-sm'>
              {mobileFeatures.map((f) => (
                <div key={f} className='flex items-center gap-2 text-white/70'>
                  <svg className='h-4 w-4 shrink-0 text-cyan-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round'>
                    <path d='m5 12 5 5 9-11' />
                  </svg>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO Content */}
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
                Free TikTok, X, Instagram, Facebook &amp; YouTube Video Downloader
              </h2>
              <p className='text-sm leading-relaxed md:text-base'>
                Save any TikTok, Twitter/X, Instagram, Facebook, or YouTube post
                in a couple of clicks. Paste the link, preview the content, and
                download the full-quality video, the original MP3 soundtrack, or
                every image from a photo carousel. Everything happens in your
                browser — no app, no sign-up, no watermark.
              </p>
            </div>

            <div className='grid gap-4 md:grid-cols-3'>
              {seoCards.map((card) => (
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
                Frequently asked questions
              </h2>
              <Accordion
                type='single'
                collapsible
                defaultValue='faq-1'
                className='space-y-3'
              >
                <AccordionItem value='faq-1'>
                  <AccordionTrigger>
                    Is this TikTok downloader free?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes — completely free, with no sign-up and no daily download
                    limit.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-2'>
                  <AccordionTrigger>
                    Do downloaded TikTok videos have a watermark?
                  </AccordionTrigger>
                  <AccordionContent>
                    No. Videos are saved in HD quality, free of the TikTok
                    watermark.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-3'>
                  <AccordionTrigger>
                    Can I download a TikTok photo carousel (slideshow)?
                  </AccordionTrigger>
                  <AccordionContent>
                    Paste the slideshow URL. The app lists every image, the
                    background track, and — when TikTok provides one — the full
                    rendered slideshow video, so you can grab the photos, the
                    MP3, or the MP4 in a single flow.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-4'>
                  <AccordionTrigger>Does it work on Twitter/X?</AccordionTrigger>
                  <AccordionContent>
                    Yes — paste any twitter.com or x.com status URL and the tool
                    resolves the underlying media automatically.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-5'>
                  <AccordionTrigger>
                    Can I download Instagram reels and photos?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes — paste a public Instagram post, reel, or carousel URL
                    (instagram.com/p/… or instagram.com/reel/…). The tool pulls
                    the video, the single photo, or every image in a carousel, no
                    login required. Private accounts and stories aren&apos;t
                    supported.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-6'>
                  <AccordionTrigger>
                    Can I download YouTube videos and Shorts?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes — paste any youtube.com/watch?v=…, youtu.be/…, or
                    /shorts/… link. The tool resolves the stream so you can
                    preview it, download the MP4 in HD, or extract the audio as an
                    MP3. Age-restricted, private, and members-only videos
                    aren&apos;t supported.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='faq-7'>
                  <AccordionTrigger>
                    Does it work with Facebook videos and reels?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes — paste a public Facebook video, watch, or reel URL
                    (facebook.com/…/videos/…, fb.watch/…, or facebook.com/reel/…)
                    and the tool extracts the HD stream for preview and download.
                    Private posts and videos from private groups aren&apos;t
                    supported.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>

          {/* Footer */}
          <footer className='animate-fade-in-up mt-10 flex flex-col items-center justify-center gap-3 border-t border-white/[0.08] pt-6 text-sm text-white/60 sm:flex-row sm:gap-5'>
            <span>
              Built by{' '}
              <a
                href='https://www.mohamedgado.com'
                target='_blank'
                rel='noopener noreferrer'
                className='font-medium text-cyan-300 underline underline-offset-2 transition-colors hover:text-cyan-200'
              >
                Mohamed Gado
              </a>
            </span>
            <span aria-hidden className='hidden text-white/20 sm:inline'>
              ·
            </span>
            <a
              href='https://www.mohamedgado.com'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-white/70 transition-colors hover:text-white'
            >
              <PortfolioIcon className='h-4 w-4' />
              Portfolio
            </a>
            <a
              href='https://github.com/Vette1123/social-media-downloader'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-white/70 transition-colors hover:text-white'
            >
              <GitHubIcon className='h-4 w-4' />
              GitHub
            </a>
            <span aria-hidden className='hidden text-white/20 sm:inline'>
              ·
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <RafiqLink />
              <span className='text-white/40'>— an app made by us</span>
            </span>
          </footer>
        </GlowCard>
      </div>
    </>
  )
}
