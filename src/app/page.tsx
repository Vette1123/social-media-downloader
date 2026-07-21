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

const heroChips = [
  'Free forever',
  'No login required',
  'No download limits',
  'HD quality',
] as const

const howItWorksSteps = [
  {
    n: 1,
    title: 'Copy a video URL',
    sub: 'From TikTok, X, Instagram, Facebook, or YouTube.',
  },
  {
    n: 2,
    title: 'Paste & download',
    sub: 'We resolve the media in seconds — right in your browser.',
  },
  {
    n: 3,
    title: 'Save it',
    sub: 'Video, MP3, or the full image gallery. Done.',
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
  {
    Icon: IconVideo,
    label: 'HD video',
    sub: 'Full-quality MP4 with the watermark stripped, seeking works.',
  },
  {
    Icon: IconAudio,
    label: 'MP3 audio',
    sub: 'Pull the soundtrack — perfect for trending sounds.',
  },
  {
    Icon: IconGallery,
    label: 'Photo galleries',
    sub: 'Carousels come through at full resolution to pick from.',
  },
  {
    Icon: IconZip,
    label: 'Batch ZIP',
    sub: 'Grab every image in a slideshow as one download.',
  },
] as const

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

// The 5 brand tiles that sit above the headline — each links to its dedicated
// downloader page.
const heroPlatforms = [
  {
    href: '/tiktok-downloader',
    label: 'TikTok video downloader',
    tile: 'bg-[#010101]',
    Icon: TikTokIcon,
    brand: false,
  },
  {
    href: '/twitter-video-downloader',
    label: 'Twitter/X video downloader',
    tile: 'bg-black',
    Icon: TwitterXIcon,
    brand: false,
  },
  {
    href: '/instagram-downloader',
    label: 'Instagram reels & photo downloader',
    tile: '',
    Icon: InstagramIcon,
    brand: true,
  },
  {
    href: '/facebook-downloader',
    label: 'Facebook video & reels downloader',
    tile: '',
    Icon: FacebookIcon,
    brand: true,
  },
  {
    href: '/youtube-downloader',
    label: 'YouTube & Shorts downloader',
    tile: '',
    Icon: YouTubeIcon,
    brand: true,
  },
] as const

// Centered section header (title + one-line sub). Used by the full-width bands.
function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className='mx-auto mb-9 max-w-2xl text-center'>
      <h2 className='text-2xl font-bold tracking-tight text-white text-balance sm:text-3xl'>
        {title}
      </h2>
      <p className='mt-3 text-sm text-white/60 md:text-base'>{sub}</p>
    </div>
  )
}

// Small uppercase eyebrow with a fading cyan hairline — for in-column labels.
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.13em] uppercase text-white/60'>
      {children}
      <span className='h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent' />
    </h3>
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
      <div className='relative min-h-[100dvh] overflow-clip bg-[#08080a]'>
        {/* Fixed so the interactive grid + spotlight track the viewport across
            the full scroll length of the page. */}
        <div className='pointer-events-none fixed inset-0 z-0'>
          <InteractiveBackground />
        </div>

        <div className='relative z-10 mx-auto max-w-6xl px-4 py-10 sm:py-16'>
          {/* ---------------------------------------------------------------
              HERO — brand tiles, headline, and the paste-bar (the product).
              Download results expand directly under the bar, inside the card.
          ---------------------------------------------------------------- */}
          <GlowCard className='animate-card-enter mx-auto w-full max-w-3xl rounded-3xl p-5 shadow-2xl sm:p-8 md:p-10'>
            <div className='animate-fade-in-up text-center'>
              <div className='mb-6 flex justify-center'>
                <div className='flex items-center gap-2 md:gap-2.5'>
                  {heroPlatforms.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      aria-label={p.label}
                      className='block'
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/15 shadow-lg shadow-black/30 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-cyan-400/40 md:h-12 md:w-12 ${
                          p.brand ? '' : p.tile
                        }`}
                      >
                        {p.brand ? (
                          <p.Icon className='h-full w-full' />
                        ) : (
                          <p.Icon className='h-5 w-5 text-white md:h-6 md:w-6' />
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <h1 className='mb-3 text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl md:text-5xl'>
                Download any video,{' '}
                <span className='text-grad'>watermark-free</span>
              </h1>
              <p className='mx-auto mb-7 max-w-xl text-sm text-white/70 md:text-base'>
                Save videos without watermarks, extract MP3 audio, or grab full
                image galleries from TikTok, X, Instagram, Facebook &amp;
                YouTube.
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

          {/* ---------------------------------------------------------------
              WHAT YOU CAN DO — 4-across feature band
          ---------------------------------------------------------------- */}
          <section className='mt-16 sm:mt-24'>
            <SectionHead
              title='Everything from one link'
              sub='One paste, four ways to save it. No app, no account, nothing installed.'
            />
            <div className='grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4'>
              {whatYouCanDo.map((t) => (
                <div
                  key={t.label}
                  className='group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/30'
                >
                  <t.Icon className='mb-4 h-6 w-6 text-cyan-300 drop-shadow-[0_2px_6px_rgba(34,211,238,0.35)]' />
                  <p className='font-semibold text-white'>{t.label}</p>
                  <p className='mt-1 text-sm text-white/60'>{t.sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------------------------------------------------------
              HOW IT WORKS — 3 steps
          ---------------------------------------------------------------- */}
          <section className='mt-16 sm:mt-24'>
            <SectionHead
              title='Three steps, a few seconds'
              sub='No tutorials. No settings. Paste and go.'
            />
            <ol className='grid gap-3 md:grid-cols-3 md:gap-4'>
              {howItWorksSteps.map((s) => (
                <li
                  key={s.n}
                  id={`step-${s.n}`}
                  className='scroll-mt-24 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6'
                >
                  <div className='btn-grad mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold'>
                    {s.n}
                  </div>
                  <p className='font-semibold text-white'>{s.title}</p>
                  <p className='mt-1 text-sm text-white/60'>{s.sub}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------------------------------------------------------------
              PLATFORM QUICK LINKS
          ---------------------------------------------------------------- */}
          <section className='mt-16 sm:mt-24'>
            <SectionHead
              title='Jump to a dedicated downloader'
              sub='Prefer a page built for one platform? Pick yours.'
            />
            <nav
              aria-label='Per-platform downloaders'
              className='flex flex-wrap justify-center gap-2.5'
            >
              {platforms.map((p) => {
                const cfg = platformLinkTiles[p.slug]
                if (!cfg) return null
                const { tile, Icon } = cfg
                const useBrandTile = !tile.startsWith('bg-transparent')
                return (
                  <Link
                    key={p.slug}
                    href={`/${p.slug}`}
                    className='inline-flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:text-white'
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                        useBrandTile ? tile : ''
                      }`}
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
          </section>

          {/* ---------------------------------------------------------------
              SEO PROSE + FAQ — two columns on desktop
          ---------------------------------------------------------------- */}
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
                Free TikTok, X, Instagram, Facebook &amp; YouTube Video
                Downloader
              </h2>
              <p className='mb-4 max-w-[60ch] text-sm leading-relaxed text-white/80 md:text-base'>
                Save any TikTok, Twitter/X, Instagram, Facebook, or YouTube post
                in a couple of clicks. Paste the link, preview the content, and
                download the full-quality video, the original MP3 soundtrack, or
                every image from a photo carousel.
              </p>
              <p className='mb-8 max-w-[60ch] text-sm leading-relaxed text-white/80 md:text-base'>
                Everything happens in your browser — no app, no sign-up, no
                watermark, and no limit on how much you save.
              </p>

              <Eyebrow>Supported link formats</Eyebrow>
              <ul className='grid grid-cols-1 gap-x-6 gap-y-1.5 font-mono text-[11px] text-white/55 sm:grid-cols-2 md:text-xs'>
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

            <div>
              <h2 className='mb-5 text-2xl font-bold tracking-tight text-white md:text-3xl'>
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
          <footer className='mt-16 flex flex-col items-center justify-center gap-3 border-t border-white/[0.08] pt-8 text-sm text-white/60 sm:mt-24 sm:flex-row sm:gap-5'>
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
        </div>
      </div>
    </>
  )
}
