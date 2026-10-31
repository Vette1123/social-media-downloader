import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collectDeepStrings } from '../../scripts/i18n-deep.mjs'
import { homepageFaqs } from '@/lib/homepageFaqs'
import { LOCALE_CONTENT } from '@/lib/localeContent'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { pageCopy } from '@/lib/pageCopy'
import { platforms, platformsBySlug } from '@/lib/platforms'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'

const english = {
  copy: pageCopy,
  homeFaqs: homepageFaqs.map(({ q, a }) => ({ q, a })),
  platforms: Object.fromEntries(
    platforms.map((p) => [
      p.slug,
      {
        brandLabel: p.brandLabel,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        h1: p.h1,
        tagline: p.tagline,
        intro: p.intro,
        cards: p.cards,
        faqs: p.faqs.map(({ q, a }) => ({ q, a })),
        featureList: p.featureList,
      },
    ]),
  ),
}

/** Every string in a document, by its path, so failures name the exact field. */
function leaves(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`))
  }
  throw new Error(`Not text at ${path}`)
}

const tokens = (text: string): string[] => [...(text.match(/\{\w+\}/g) ?? [])].sort()

// Short strings legitimately survive translation: "MP3 audio", "Batch ZIP".
const MIN_UNTRANSLATED = 40

describe('platform slugs', () => {
  it('names every platform page', () => {
    expect([...PLATFORM_SLUGS].sort()).toEqual(platforms.map((p) => p.slug).sort())
  })
})

describe.each(ROUTE_LOCALES)('%s page content', (locale) => {
  const content = LOCALE_CONTENT[locale]
  const source = new Map(leaves(english))
  const translated = new Map(leaves(content))

  it('has exactly the fields of the English source', () => {
    expect([...translated.keys()].sort()).toEqual([...source.keys()].sort())
  })

  it('leaves no field empty or still in English', () => {
    const failures = [...translated].filter(([path, text]) => {
      const original = source.get(path) ?? ''
      return !text.trim() || (original.length >= MIN_UNTRANSLATED && text === original)
    })
    expect(failures).toEqual([])
  })

  it('keeps every {placeholder}', () => {
    const failures = [...translated]
      .filter(([path, text]) => tokens(text).join() !== tokens(source.get(path) ?? '').join())
      .map(([path]) => path)
    expect(failures).toEqual([])
  })

  it('fits a search result: title 60, description 160', () => {
    const pages = [content.copy.home, ...Object.values(content.platforms)]
    const long = pages.flatMap((p) => [
      ...(p.metaTitle.length > 60 ? [`${p.metaTitle.length}: ${p.metaTitle}`] : []),
      ...(p.metaDescription.length > 160
        ? [`${p.metaDescription.length}: ${p.metaDescription}`]
        : []),
    ])
    expect(long).toEqual([])
  })

  it('names the platform in each page title', () => {
    const missing = PLATFORM_SLUGS.filter((slug) => {
      const { name } = platformsBySlug[slug]
      // The universal page names no one platform.
      if (slug === 'video-downloader') return false
      // 'Twitter/X' may be written as either half.
      return !name.split('/').some((part) => content.platforms[slug].metaTitle.includes(part))
    })
    expect(missing).toEqual([])
  })

  it('keeps the rule that supporting never widens reach', () => {
    const support = leaves(content.copy.support).map(([, text]) => text).join(' ')
    expect(support).not.toMatch(/private|privad|privat|خاص/i)
  })
})

describe('translation lock', () => {
  const LOCK = 'src/content/locales/en.lock.json'
  const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12)
  const current = Object.fromEntries(leaves(english).map(([path, text]) => [path, hash(text)]))
  for (const sentence of collectDeepStrings().strings) {
    current[`deep:${sentence}`] = hash(sentence)
  }

  it('matches English, or a translator has not seen the change', () => {
    if (process.env.I18N_LOCK) {
      writeFileSync(LOCK, `${JSON.stringify(current, null, 1)}\n`)
      return
    }
    const locked: Record<string, string> = JSON.parse(readFileSync(LOCK, 'utf8'))
    const changed = [...new Set([...Object.keys(current), ...Object.keys(locked)])].filter(
      (path) => current[path] !== locked[path],
    )
    // Update src/content/locales and its deep/ folder, then `pnpm i18n:lock`.
    expect(changed).toEqual([])
  })
})

describe.each(ROUTE_LOCALES)('%s rare sentences', (locale) => {
  const { strings, errors } = collectDeepStrings() as { strings: string[]; errors: string[] }
  const dictionary: Record<string, string> = JSON.parse(
    readFileSync(`src/content/locales/deep/${locale}.json`, 'utf8'),
  )

  it('finds every sentence at its call site', () => {
    expect(errors).toEqual([])
  })

  it('has every sentence, and nothing stale', () => {
    expect(strings.filter((s) => !dictionary[s])).toEqual([])
    expect(Object.keys(dictionary).filter((s) => !strings.includes(s))).toEqual([])
  })

  // {noun} is English grammar: a language may use one general word instead.
  it('keeps the placeholders the sentence fills in', () => {
    const lost = strings.filter((s) =>
      tokens(s).some((token) => token !== '{noun}' && !tokens(dictionary[s] ?? s).includes(token)),
    )
    expect(lost).toEqual([])
  })

  it('invents no placeholder of its own', () => {
    const invented = strings.filter((s) =>
      tokens(dictionary[s] ?? s).some((token) => !tokens(s).includes(token)),
    )
    expect(invented).toEqual([])
  })
})

describe.each(ROUTE_LOCALES)('%s legal pages', (locale) => {
  const { legal } = LOCALE_CONTENT[locale].copy

  it.each(['pro', 'privacy', 'terms'] as const)('%s fits a search result', (page) => {
    expect(legal[page].metaTitle.length).toBeLessThanOrEqual(60)
    expect(legal[page].metaDescription.length).toBeLessThanOrEqual(160)
  })
})
