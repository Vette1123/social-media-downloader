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
import { platforms } from '@/lib/platforms'
import { homepageStructuredData } from '@/lib/structuredData'

const devLinks = [
  {
    href: 'https://www.mohamedgado.com/',
    label: 'Portfolio',
    Icon: PortfolioIcon,
    grad: 'from-pink-500/80 to-violet-500/80',
  },
  {
    href: 'https://github.com/Vette1123/social-media-downloader',
    label: 'GitHub',
    Icon: GitHubIcon,
    grad: 'from-violet-500/80 to-cyan-400/80',
  },
] as const

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

const whatYouCanDo = [
  {
    emoji: '🎬',
    label: 'HD Video',
    sub: 'No watermark',
    grad: 'from-pink-500/20 to-rose-500/10',
    ring: 'ring-pink-500/30',
  },
  {
    emoji: '🎵',
    label: 'MP3 audio',
    sub: 'Extract soundtrack',
    grad: 'from-emerald-500/20 to-teal-500/10',
    ring: 'ring-emerald-500/30',
  },
  {
    emoji: '🖼️',
    label: 'Slideshow',
    sub: 'Image carousels',
    grad: 'from-violet-500/20 to-fuchsia-500/10',
    ring: 'ring-violet-500/30',
  },
  {
    emoji: '🗜️',
    label: 'Batch ZIP',
    sub: 'All images at once',
    grad: 'from-sky-500/20 to-cyan-500/10',
    ring: 'ring-cyan-500/30',
  },
] as const

const trustStrip = [
  { k: 'Free', v: 'forever', accent: 'text-emerald-300' },
  { k: 'No login', v: 'required', accent: 'text-sky-300' },
  { k: 'No limit', v: 'on downloads', accent: 'text-pink-300' },
] as const

const mobileFeatures = [
  { color: 'bg-green-400', label: 'Watermark-free downloads' },
  { color: 'bg-blue-400', label: 'HD quality preservation' },
  { color: 'bg-purple-400', label: 'MP3 audio extraction' },
  { color: 'bg-pink-400', label: 'Video preview' },
  { color: 'bg-yellow-400', label: 'Image gallery downloads' },
  { color: 'bg-indigo-400', label: 'Multiple URL formats' },
  { color: 'bg-teal-400', label: 'Batch image selection' },
  { color: 'bg-orange-400', label: 'Fast processing' },
] as const

const seoCards = [
  {
    title: '🎬 Videos in HD',
    body: 'Watermark-free TikTok downloads plus native Twitter/X, Facebook, and YouTube (including Shorts) video rips, served with proper range requests so preview and seeking work flawlessly.',
  },
  {
    title: '🎵 MP3 audio extraction',
    body: 'Pull the soundtrack from any TikTok video or slideshow. Photo carousels keep the original background music — perfect for trending sounds.',
  },
  {
    title: '🖼️ Photo carousels',
    body: 'TikTok slideshows come through as a full-resolution gallery. Preview, pick favorites, then save individually or as a single ZIP.',
  },
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

function IdleRightContent() {
  return (
    <div className='space-y-4'>
      {/* What you can do — 2x2 bento grid */}
      <div
        className='animate-fade-in-up bg-white/5 rounded-xl p-5 border border-white/10'
        style={{ animationDelay: '150ms' }}
      >
        <h3 className='text-white font-semibold mb-4 text-sm md:text-base flex items-center'>
          ✨ What you can do
          <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded' />
        </h3>
        <div className='grid grid-cols-2 gap-3'>
          {whatYouCanDo.map((t) => (
            <div
              key={t.label}
              className={`bg-gradient-to-br ${t.grad} rounded-lg p-3 ring-1 ${t.ring} border border-white/5 transition-transform duration-200 hover:-translate-y-0.5`}
            >
              <div className='text-2xl mb-1.5 leading-none'>{t.emoji}</div>
              <p className='text-white text-sm font-semibold leading-tight'>
                {t.label}
              </p>
              <p className='text-white/55 text-xs mt-0.5'>{t.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported link formats */}
      <div
        className='animate-fade-in-up bg-white/5 rounded-xl p-5 border border-white/10'
        style={{ animationDelay: '230ms' }}
      >
        <h3 className='text-white font-semibold mb-3 text-sm md:text-base flex items-center'>
          🔗 Supported link formats
          <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-cyan-400 to-sky-500 rounded' />
        </h3>
        <ul className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] md:text-xs text-white/65 font-mono'>
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
      className='animate-fade-in-up mt-8 rounded-xl bg-white/5 border border-white/10 p-4'
      style={{ animationDelay: '260ms' }}
    >
      <p className='text-white/65 text-xs md:text-sm mb-3'>
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

export default function Home() {
  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageStructuredData()),
        }}
      />
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
        {/* Header */}
        <div className='animate-fade-in-up text-center mb-6 md:mb-8'>
          <div className='flex justify-center mb-4'>
            <div className='flex items-center gap-2 md:gap-2.5'>
              <Link
                href='/tiktok-downloader'
                aria-label='TikTok video downloader'
                className='block'
              >
                <span className='w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#010101] flex items-center justify-center ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-white/35'>
                  <TikTokIcon className='w-5 h-5 md:w-6 md:h-6 text-white' />
                </span>
              </Link>
              <Link
                href='/twitter-video-downloader'
                aria-label='Twitter/X video downloader'
                className='block'
              >
                <span className='w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black flex items-center justify-center ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-white/35'>
                  <TwitterXIcon className='w-5 h-5 md:w-6 md:h-6 text-white' />
                </span>
              </Link>
              <Link
                href='/instagram-downloader'
                aria-label='Instagram reels & photo downloader'
                className='block'
              >
                <span className='w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden flex ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-white/35'>
                  <InstagramIcon className='w-full h-full' />
                </span>
              </Link>
              <Link
                href='/facebook-downloader'
                aria-label='Facebook video & reels downloader'
                className='block'
              >
                <span className='w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden flex ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-white/35'>
                  <FacebookIcon className='w-full h-full' />
                </span>
              </Link>
              <Link
                href='/youtube-downloader'
                aria-label='YouTube & Shorts downloader'
                className='block'
              >
                <span className='w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden flex ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-white/35'>
                  <YouTubeIcon className='w-full h-full' />
                </span>
              </Link>
            </div>
          </div>
          <h1 className='text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2'>
            Social Media Downloader
          </h1>
          <p className='text-sm md:text-base text-white/70 mb-4'>
            Download videos without watermarks, extract MP3 audio, or save
            images from TikTok, X, Instagram, Facebook &amp; YouTube
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

        {/* Interactive island — form + results */}
        <DownloaderApp
          idleLeftSlot={<HowItWorks />}
          idleRightSlot={<IdleRightContent />}
        />

        <PlatformLinks />

        {/* Features List - Mobile only */}
        <div
          className='animate-fade-in-up lg:hidden bg-white/5 rounded-xl p-4 mt-6 border border-white/10'
          style={{ animationDelay: '200ms' }}
        >
          <h3 className='text-white font-semibold mb-4 text-sm md:text-base flex items-center'>
            ✨ Features
            <div className='ml-2 w-8 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded' />
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm'>
            {mobileFeatures.map((f) => (
              <div
                key={f.label}
                className='flex items-center space-x-2 text-white/70'
              >
                <div className={`w-2 h-2 ${f.color} rounded-full`} />
                <span>{f.label}</span>
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
              className='text-xl md:text-2xl font-bold text-white mb-3'
            >
              Free TikTok, X, Instagram, Facebook &amp; YouTube Video Downloader
            </h2>
            <p className='text-sm md:text-base leading-relaxed'>
              Save any TikTok, Twitter/X, Instagram, Facebook, or YouTube post
              in a couple of clicks. Paste the link, preview the content, and
              download the full-quality video, the original MP3 soundtrack, or
              every image from a photo carousel. Everything happens in your
              browser — no app, no sign-up, no watermark.
            </p>
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            {seoCards.map((card) => (
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
        <footer className='animate-fade-in-up mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-sm text-white/60'>
          <span>
            Built by{' '}
            <a
              href='https://www.mohamedgado.com'
              target='_blank'
              rel='noopener noreferrer'
              className='font-medium text-pink-300 hover:text-pink-200 underline underline-offset-2 transition-colors'
            >
              Mohamed Gado
            </a>
          </span>
          <span aria-hidden className='hidden sm:inline text-white/20'>
            •
          </span>
          <a
            href='https://www.mohamedgado.com'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors'
          >
            <PortfolioIcon className='w-4 h-4' />
            Portfolio
          </a>
          <a
            href='https://github.com/Vette1123/social-media-downloader'
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
    </>
  )
}
