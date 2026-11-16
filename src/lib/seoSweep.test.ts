import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { metadata as notFoundMetadata } from '@/app/not-found'
import { LOCALES } from '@/lib/i18n'
import { contentFor } from '@/lib/localeContent'
import { ogImageAlt } from '@/lib/pageMetadata'
import { platforms } from '@/lib/platforms'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'

const root = process.cwd()

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('share-card alt text', () => {
  const english = (slug?: (typeof PLATFORM_SLUGS)[number]) => ogImageAlt('en', slug)

  it.each(LOCALES)('%s: the home page and every platform page have one', (locale) => {
    expect(ogImageAlt(locale).trim()).not.toBe('')
    for (const slug of PLATFORM_SLUGS) expect(ogImageAlt(locale, slug).trim()).not.toBe('')
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s: is in that language, not English', (locale) => {
    expect(ogImageAlt(locale)).not.toBe(english())
    const same = PLATFORM_SLUGS.filter((slug) => ogImageAlt(locale, slug) === english(slug))
    expect(same).toEqual([])
  })

  // A file's `alt` export would be a second, English tag beside the localized one.
  it('no home or platform card file exports a fixed alt', () => {
    const files = walk(join(root, 'src/app')).filter(
      (f) => /(opengraph|twitter)-image\.tsx$/.test(f) && !/[\\/]pro[\\/]/.test(f),
    )
    expect(files.length).toBeGreaterThan(30)
    expect(files.filter((f) => /^export const alt\b/m.test(readFileSync(f, 'utf8')))).toEqual([])
  })
})

describe('404 page', () => {
  it('leaves robots to the single noindex Next emits', () => {
    expect(notFoundMetadata.robots).toBeNull()
  })
})

describe('manifest shortcuts', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json'), 'utf8')) as {
    shortcuts: Array<{ url: string }>
  }

  it('stay within the ten browsers show, each a real landing page', () => {
    expect(manifest.shortcuts.length).toBeLessThanOrEqual(10)
    const slugs = platforms.map((p) => `/${p.slug}`)
    expect(manifest.shortcuts.filter((s) => !slugs.includes(s.url))).toEqual([])
    expect(new Set(manifest.shortcuts.map((s) => s.url)).size).toBe(manifest.shortcuts.length)
  })

  it('cover the most used platforms', () => {
    const urls = manifest.shortcuts.map((s) => s.url)
    for (const slug of ['tiktok', 'instagram', 'youtube', 'facebook', 'pinterest']) {
      expect(urls.some((u) => u.includes(slug))).toBe(true)
    }
  })
})

describe('Indonesian wording', () => {
  // "Download" and "Unduh" both named the one action. Unduh/Pengunduh only now.
  it('says Unduh and Pengunduh, never Download or downloader', () => {
    const { copy, homeFaqs, platforms: pages } = contentFor('id')
    const text = JSON.stringify([copy, homeFaqs, pages])
      .replace(/Social Media Downloader|SocialDownloaderSpaceBot/g, '')
      .replace(/[\w-]+-downloader/g, '')
    expect(text.match(/\b[Dd]ownload(er)?\b/g)).toBeNull()
  })
})
