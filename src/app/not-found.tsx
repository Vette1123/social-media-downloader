import type { Metadata } from 'next'
import { NotFoundBody } from '@/components/NotFoundBody'
import { NotFoundTracker } from '@/components/NotFoundTracker'
import { Surface } from '@/components/Surface'
import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

export const metadata: Metadata = {
  // `absolute` bypasses the layout's `%s — <name>` template, which was
  // appending the site name to a title that already ended with it.
  title: { absolute: `Page not found — ${siteConfig.name}` },
  description:
    'The page you are looking for does not exist. Head back to the downloader or pick a platform-specific tool.',
  // The root layout's `index, follow` would be inherited and sit beside the
  // `noindex` Next emits for every not-found page. `null` drops the inherited
  // tag (and its googlebot twin), leaving Next's single `noindex`.
  robots: null,
}

export default function NotFound() {
  return (
    <main className='app-bg relative flex min-h-[100dvh] items-center justify-center overflow-clip px-4 py-6'>
      <NotFoundTracker />
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
        <NotFoundBody
          links={platforms.map(({ slug, brandLabel }) => ({ slug, brandLabel }))}
        />
      </Surface>
    </main>
  )
}
