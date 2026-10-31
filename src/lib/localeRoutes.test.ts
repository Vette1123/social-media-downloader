import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouteDictionary } from '@/components/RouteLocale'
import { useT } from '@/lib/i18nStore'
import {
  equivalentPath,
  localeFromPath,
  localePath,
  stripLocale,
} from '@/lib/localeRoutes'
import { languageAlternates, platformMetadata, staticOpenGraph } from '@/lib/pageMetadata'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

describe('locale URLs', () => {
  it('reads the language from the first segment only', () => {
    expect(localeFromPath('/es/tiktok-downloader')).toBe('es')
    expect(localeFromPath('/ar')).toBe('ar')
    expect(localeFromPath('/')).toBeNull()
    expect(localeFromPath('/en')).toBeNull()
    expect(localeFromPath('/tiktok-downloader/es')).toBeNull()
    expect(localeFromPath(null)).toBeNull()
  })

  it('round-trips a path through a language', () => {
    expect(localePath('es', '/')).toBe('/es')
    expect(localePath('en', '/')).toBe('/')
    expect(stripLocale(localePath('pt', '/vimeo-downloader'))).toBe('/vimeo-downloader')
    expect(stripLocale('/ar')).toBe('/')
  })

  it('finds a page in another language, and only where one exists', () => {
    expect(equivalentPath('/es/tiktok-downloader', 'ar')).toBe('/ar/tiktok-downloader')
    expect(equivalentPath('/ar/', 'en')).toBe('/')
    expect(equivalentPath('/', 'id')).toBe('/id')
    expect(equivalentPath('/pro', 'es')).toBeNull()
  })
})

describe('page metadata', () => {
  it('declares every language and itself, in every language', () => {
    const languages = languageAlternates('/vimeo-downloader')
    expect(languages).toEqual({
      en: '/vimeo-downloader',
      es: '/es/vimeo-downloader',
      pt: '/pt/vimeo-downloader',
      id: '/id/vimeo-downloader',
      ar: '/ar/vimeo-downloader',
      'x-default': '/vimeo-downloader',
    })
    const page = platformMetadata('vimeo-downloader', 'ar')
    expect(page.alternates?.canonical).toBe('/ar/vimeo-downloader')
    expect(page.alternates?.languages).toEqual(languages)
  })

  it('shares a static page as itself, not as the home page', () => {
    expect(staticOpenGraph('/pro', 't', 'd')).toMatchObject({
      url: expect.stringMatching(/\/pro$/),
    })
  })
})

describe('the language of a page', () => {
  function Probe() {
    return useT()('paste')
  }

  const render = () =>
    renderToString(
      RouteDictionary({
        locale: 'es',
        dictionary: { paste: 'Pegar' },
        children: createElement(Probe),
      }),
    )

  it('is in the first render of a localized URL, not after hydration', () => {
    pathname = '/es'
    expect(render()).toBe('Pegar')
  })

  it('stays English on an English URL with the same dictionary loaded', () => {
    pathname = '/'
    expect(render()).toBe('Paste')
  })
})

describe('choosing a language', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('overwrites the stored language from a localized URL', async () => {
    const stored = new Map([['smd:lang', 'es']])
    vi.stubGlobal('window', {
      location: { pathname: '/es' },
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    })
    vi.resetModules()
    const { setLocale } = await import('@/lib/i18nStore')
    setLocale('en')
    expect(stored.get('smd:lang')).toBe('en')
  })
})

describe('Latin text on a right-to-left page', () => {
  it('keeps URLs readable', () => {
    for (const file of ['HomeLanding', 'PlatformLanding']) {
      const source = readFileSync(join('src', 'components', `${file}.tsx`), 'utf8')
      expect(source).toMatch(/<ul dir='ltr' className='[^']*font-mono/)
    }
    const app = readFileSync(join('src', 'components', 'DownloaderApp.tsx'), 'utf8')
    expect(app).toMatch(/<input\s+dir='auto'\s+ref=\{inputRef\}/)
  })
})

describe('translated copy', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  it('is never imported by client code, which would ship a whole language', () => {
    const offenders = sourceFiles('src').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return (
        /^['"]use client['"]/m.test(source) &&
        /@\/lib\/(localeContent|pageCopy|platforms)'|content\/locales/.test(source)
      )
    })
    expect(offenders).toEqual([])
  })
})
