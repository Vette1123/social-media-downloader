import type { Metadata } from 'next'
import Link from 'next/link'
import { Surface } from '@/components/Surface'
import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

export const metadata: Metadata = {
  // `absolute` bypasses the layout's `%s — <name>` template, which was
  // appending the site name to a title that already ended with it.
  title: { absolute: `Page not found — ${siteConfig.name}` },
  description:
    'The page you are looking for does not exist. Head back to the downloader or pick a platform-specific tool.',
  // Required, not redundant. The root layout declares `index, follow` for the
  // whole site, and without an override here that value is inherited and
  // rendered alongside the `noindex` Next emits for the not-found page — two
  // robots tags saying opposite things. Next's own tag is not suppressible, so
  // the goal is for both to agree.
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className='app-bg relative flex min-h-[100dvh] items-center justify-center overflow-clip px-4 py-6'>
      <div
        aria-hidden
        className='bg-blob pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-3xl'
      />
      <div
        aria-hidden
        className='bg-blob pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-sky-500/10 blur-3xl'
      />

      <Surface
        glow
        radius='3xl'
        className='relative z-10 w-full max-w-xl p-6 md:p-8 text-center shadow-2xl'
      >
        <p className='text-grad text-sm md:text-base font-semibold tracking-wider uppercase'>
          404
        </p>
        <h1 className='mt-2 mb-3 text-2xl md:text-3xl font-bold text-white'>
          That page wandered off.
        </h1>
        <p className='mb-6 text-sm md:text-base text-white/70'>
          The URL you opened doesn’t match anything here. Try the main
          downloader or pick a platform-specific tool below.
        </p>

        <Link
          href='/'
          className='btn-grad inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5'
        >
          ← Back to the downloader
        </Link>

        <div className='mt-8 flex flex-wrap justify-center gap-2'>
          {platforms.map((p) => (
            <Surface
              key={p.slug}
              as={Link}
              href={`/${p.slug}`}
              elevation='raised'
              interaction='lift'
              radius='lg'
              className='inline-flex items-center px-3 py-1.5 text-xs md:text-sm text-white/80 hover:text-white'
            >
              {p.brandLabel}
            </Surface>
          ))}
        </div>
      </Surface>
    </div>
  )
}
