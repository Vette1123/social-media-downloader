import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

export const metadata: Metadata = {
  title: `Page not found — ${siteConfig.name}`,
  description:
    'The page you are looking for does not exist. Head back to the downloader or pick a platform-specific tool.',
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

      <div className='glow-card relative z-10 w-full max-w-xl rounded-3xl p-6 md:p-8 text-center shadow-2xl backdrop-blur-md'>
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
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className='inline-flex items-center rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs md:text-sm text-white/80 transition-colors hover:border-cyan-400/40 hover:text-white'
            >
              {p.brandLabel}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
