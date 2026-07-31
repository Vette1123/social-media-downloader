import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms for using ${siteConfig.name}: as-is service, your responsibility for content rights, and Pro license refunds.`,
  alternates: { canonical: '/terms' },
}

const UPDATED = '31 July 2026'

export default function Terms() {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <h1 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          Terms of Service
        </h1>
        <p className='mt-2 text-sm text-white/50'>Last updated {UPDATED}</p>

        <div className='mt-8 space-y-6 text-sm leading-relaxed text-white/70 md:text-base'>
          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Provided as-is</h2>
            <p>
              {siteConfig.name} is provided &ldquo;as is&rdquo; with no warranty of
              any kind, express or implied. We do not guarantee uninterrupted
              access, that every link will resolve, or that any particular
              platform will keep working.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Your responsibility</h2>
            <p>
              You are responsible for having the right to download any content
              you process through this site &mdash; your own uploads, content
              you have permission to save, or material that is otherwise legally
              yours to download. We do not host or vet the media you link to.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>No commercial redistribution</h2>
            <p>
              Downloaded media is for personal use. You may not resell,
              re-upload for profit, or otherwise commercially redistribute
              content you did not create or license.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Pro licenses and refunds</h2>
            <p>
              Pro licenses are sold and processed by Lemon Squeezy and are
              refundable within 14 days of purchase through Lemon Squeezy.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Changes to the service</h2>
            <p>
              The service may change, be limited, or be discontinued at any time
              without notice.
            </p>
          </section>

          <section>
            <h2 className='mb-2 text-lg font-semibold text-white'>Contact</h2>
            <p>
              Questions: <a className='text-cyan-300 hover:text-cyan-200' href={siteConfig.author.url}>{siteConfig.author.name}</a>.
            </p>
          </section>
        </div>

        <Link href='/' className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'>
          ← Back to the downloader
        </Link>
      </div>
    </div>
  )
}
