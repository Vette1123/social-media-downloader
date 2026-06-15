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
    <div className='relative min-h-screen overflow-clip bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex justify-center items-center py-6 px-4'>
      <div
        aria-hidden
        className='pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pink-500/30 blur-3xl'
      />
      <div
        aria-hidden
        className='pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-cyan-400/25 blur-3xl'
      />

      <div className='relative z-10 w-full max-w-xl bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-2xl border border-white/20 text-center'>
        <p className='text-pink-300 font-semibold text-sm md:text-base tracking-wider uppercase'>
          404
        </p>
        <h1 className='text-2xl md:text-3xl font-bold text-white mt-2 mb-3'>
          That page wandered off.
        </h1>
        <p className='text-sm md:text-base text-white/70 mb-6'>
          The URL you opened doesn’t match anything here. Try the main
          downloader or pick a platform-specific tool below.
        </p>

        <Link
          href='/'
          className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 text-white font-semibold shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-shadow'
        >
          ← Back to the downloader
        </Link>

        <div className='mt-8 flex flex-wrap justify-center gap-2'>
          {platforms.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className='inline-flex items-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/80 hover:text-white hover:border-white/40 text-xs md:text-sm transition-colors'
            >
              {p.brandLabel}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
