'use client'

import { useEffect } from 'react'
import Link from '@/components/IntentLink'
import { Surface } from '@/components/Surface'
import { siteConfig } from '@/config/site'
import { useHydrated } from '@/lib/clientEnv'
import { d, useDeepWords } from '@/lib/i18nDeep'
import { useLocale } from '@/lib/i18nStore'
import { localePath } from '@/lib/localeRoutes'

/**
 * One 404 file answers every language's missing URL, so it prerenders in English
 * and takes the language from the address once it is running.
 */
export function NotFoundBody({
  links,
}: {
  links: Array<{ slug: string; brandLabel: string }>
}) {
  const wordsReady = useDeepWords()
  const locale = useLocale()
  const hydrated = useHydrated()
  useEffect(() => {
    if (locale !== 'en' && wordsReady) {
      document.title = `${d('Page not found')} — ${siteConfig.name}`
    }
  }, [locale, wordsReady])
  const to = (path: string) => (hydrated ? localePath(locale, path) : path)
  return (
    <>
      <h1 className='mt-2 mb-3 text-2xl md:text-3xl font-bold text-white'>
        {d('That page wandered off.')}
      </h1>
      <p className='mb-6 text-sm md:text-base text-white/70'>
        {d(
          'The URL you opened doesn’t match anything here. Try the main downloader or pick a platform-specific tool below.',
        )}
      </p>

      <Link
        href={to('/')}
        className='btn-grad inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5'
      >
        {d('← Back to the downloader')}
      </Link>

      <div className='mt-8 flex flex-wrap justify-center gap-2'>
        {links.map((p) => (
          <Surface
            key={p.slug}
            as={Link}
            href={to(`/${p.slug}`)}
            elevation='raised'
            interaction='lift'
            radius='lg'
            className='inline-flex items-center px-3 py-1.5 text-xs md:text-sm text-white/80 hover:text-white'
          >
            {p.brandLabel}
          </Surface>
        ))}
      </div>
    </>
  )
}
