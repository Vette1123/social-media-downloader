import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pageCopy } from './pageCopy'
import { LOCALES } from './i18n'
import { contentFor, platformFor } from './localeContent'
import { platforms } from './platforms'
import {
  globalStructuredData,
  homepageStructuredData,
  infoStructuredData,
  jsonLdText,
  platformStructuredData,
} from './structuredData'

describe('jsonLdText', () => {
  it('cannot close its own <script> tag, and still parses to the same graph', () => {
    const graph = { name: 'a </script><img src=x onerror=alert(1)> b' }
    const text = jsonLdText(graph)
    expect(text).not.toContain('<')
    expect(JSON.parse(text)).toEqual(graph)
  })
})

// Google crawls a URL template in JSON-LD as a literal URL: the old SearchAction
// and UseAction put "/?url={search_term_string}" and "/?url={url}" into Search
// Console as pages. Every URL we publish must be a real one.
describe('structured data', () => {
  const graphs = [
    globalStructuredData,
    ...LOCALES.flatMap((locale) => [
      homepageStructuredData(locale),
      ...platforms.map((p) => platformStructuredData(p.slug, locale)),
    ]),
  ]

  it('publishes no URL template', () => {
    for (const graph of graphs) {
      const urls = JSON.stringify(graph).match(/https?:\/\/[^"\s]+/g) ?? []
      for (const url of urls) expect(url).not.toMatch(/[{}]/)
    }
  })
})

describe('platform how-to', () => {
  const howToOf = (graph: ReturnType<typeof platformStructuredData>) =>
    graph['@graph'].find((n) => n['@type'] === 'HowTo') as unknown as {
      step: Array<{ position: number; name: string; text: string }>
    }

  it.each(LOCALES)('%s: every platform has 3-4 steps, and its HowTo JSON-LD carries them', (locale) => {
    for (const { slug } of platforms) {
      const { steps } = platformFor(locale, slug)
      expect(steps.length, `${locale}/${slug}`).toBeGreaterThanOrEqual(3)
      expect(steps.length, `${locale}/${slug}`).toBeLessThanOrEqual(4)
      for (const step of steps) {
        expect(step.name.trim(), `${locale}/${slug}`).not.toBe('')
        expect(step.text.trim(), `${locale}/${slug}`).not.toBe('')
      }
      const ld = howToOf(platformStructuredData(slug, locale)).step
      expect(ld.map(({ name, text }) => ({ name, text }))).toEqual(steps)
      expect(ld.map((x) => x.position)).toEqual(steps.map((_, i) => i + 1))
    }
  })
})

describe('brand entity', () => {
  const node = (type: string) =>
    globalStructuredData['@graph'].find((n) => n['@type'] === type) as unknown as {
      sameAs: string[]
      alternateName: string[]
    }

  it('Organization.sameAs is the product, not the founder', () => {
    const { sameAs } = node('Organization')
    expect(sameAs).toEqual([
      'https://github.com/Vette1123/social-media-downloader',
      'https://t.me/SocialDownloaderSpaceBot',
    ])
    expect(sameAs.join(' ')).not.toContain('twitter.com')
  })

  it('the founder keeps their own links on the Person', () => {
    expect(node('Person').sameAs.some((u) => u.includes('twitter.com'))).toBe(true)
  })

  it('WebSite and Organization are also known as the bare domain, short name first', () => {
    const expected = ['Social Downloader', 'socialdownloader.space']
    expect(node('Organization').alternateName).toEqual(expected)
    expect(node('WebSite').alternateName).toEqual(expected)
  })
})

// The English home had two titles: the layout's own literal (what Google
// showed) and pageCopy.home (what the 2026-11-10 title change edited). Every
// English home surface now reads pageCopy.home, like the four translations.
describe('English home title and description', () => {
  const webPage = (homepageStructuredData('en')['@graph'] as Array<Record<string, unknown>>).find(
    (node) => node['@type'] === 'WebPage',
  )

  it('JSON-LD WebPage uses pageCopy.home', () => {
    expect(webPage?.name).toBe(pageCopy.home.metaTitle)
    expect(webPage?.description).toBe(pageCopy.home.metaDescription)
  })

  it('the root layout <title> and description come from pageCopy.home', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(layout).toContain('const title = pageCopy.home.metaTitle')
    expect(layout).toContain('const description = pageCopy.home.metaDescription')
    expect(layout).not.toContain('siteConfig.description')
  })
})

describe('primaryImageOfPage', () => {
  const pageNode = (graph: { '@graph': Array<Record<string, unknown>> }) =>
    graph['@graph'].find((n) => n['@type'] === 'WebPage')

  it('names each page its own share image, not the home one', () => {
    expect(pageNode(platformStructuredData('tiktok-downloader', 'ar'))?.primaryImageOfPage).toBe(
      'https://www.socialdownloader.space/ar/tiktok-downloader/opengraph-image',
    )
    expect(pageNode(homepageStructuredData('es'))?.primaryImageOfPage).toBe(
      'https://www.socialdownloader.space/es/opengraph-image',
    )
    expect(pageNode(homepageStructuredData('en'))?.primaryImageOfPage).toBe(
      'https://www.socialdownloader.space/opengraph-image',
    )
  })
})

type Node = Record<string, unknown>

const nodeOf = (graph: { '@graph': unknown[] }, type: string): Node | undefined =>
  (graph['@graph'] as Node[]).find((n) => n['@type'] === type)

const webApp = (graph: { '@graph': unknown[] }): Node | undefined =>
  (graph['@graph'] as Node[]).find((n) => String(n['@id']).endsWith('/#webapp'))

describe('WebApplication', () => {
  it('is not in the site-wide graph, which can only speak English', () => {
    expect(webApp(globalStructuredData)).toBeUndefined()
  })

  it.each(LOCALES)('%s: names every dedicated platform page', (locale) => {
    const app = webApp(homepageStructuredData(locale)) as { featureList: string[] }
    const all = app.featureList.join(' ')
    for (const p of platforms.filter((x) => x.slug !== 'video-downloader')) {
      expect(all).toContain(p.name)
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s: description, features and requirements are not English',
    (locale) => {
      const en = webApp(homepageStructuredData('en')) as Record<string, unknown>
      for (const graph of [
        homepageStructuredData(locale),
        platformStructuredData('tiktok-downloader', locale),
      ]) {
        const app = webApp(graph) as Record<string, unknown>
        expect(app.inLanguage).toBe(locale)
        expect(app.description).not.toBe(en.description)
        expect(app.browserRequirements).not.toBe(en.browserRequirements)
        const features = app.featureList as string[]
        const english = en.featureList as string[]
        expect(features).toHaveLength(english.length)
        expect(features.filter((f, i) => f === english[i])).toEqual([])
      }
    },
  )
})

describe('organization logo', () => {
  it('is a raster image, which Google requires, not the SVG favicon', () => {
    const { logo } = nodeOf(globalStructuredData, 'Organization') as unknown as {
      logo: { url: string; contentUrl: string; width: number; height: number }
    }
    expect(logo.url).toMatch(/\/icons\/512\?v=\d+$/)
    expect(logo.contentUrl).toBe(logo.url)
    expect(logo.url).not.toContain('.svg')
    expect([logo.width, logo.height]).toEqual([512, 512])
  })
})

describe('home how-to', () => {
  it.each(LOCALES)('%s: its steps are the steps the page shows', (locale) => {
    const visible = contentFor(locale).copy.home.steps
    const { step } = nodeOf(homepageStructuredData(locale), 'HowTo') as unknown as {
      step: Array<{ name: string; text: string }>
    }
    expect(step.map(({ name, text }) => ({ name, text }))).toEqual(
      visible.map(({ title, sub }) => ({ name: title, text: sub })),
    )
  })
})

describe('the Download button', () => {
  // The button reads "Download" (or its translation). No "Process URL" exists.
  const STALE = /Process URL|Procesar URL|Processar URL|Proses URL|معالجة الرابط/
  it.each(LOCALES)('%s: no copy or markup sends people to a Process URL button', (locale) => {
    const { copy, homeFaqs, platforms: pages } = contentFor(locale)
    const text = JSON.stringify([copy, homeFaqs, pages, homepageStructuredData(locale)])
    expect(text).not.toMatch(STALE)
  })
})

describe('home breadcrumb', () => {
  it.each(LOCALES)('%s: the home page has no one-item trail, a platform page does', (locale) => {
    const home = homepageStructuredData(locale)
    expect(nodeOf(home, 'BreadcrumbList')).toBeUndefined()
    expect(nodeOf(home, 'WebPage')).not.toHaveProperty('breadcrumb')
    const page = platformStructuredData('tiktok-downloader', locale)
    expect(nodeOf(page, 'BreadcrumbList')).toBeDefined()
    expect(nodeOf(page, 'WebPage')).toHaveProperty('breadcrumb')
  })
})

describe('home FAQ', () => {
  it.each(LOCALES)('%s: is about the downloader, not TikTok alone', (locale) => {
    const { homeFaqs } = contentFor(locale)
    // A question may name TikTok next to the other platforms, never by itself.
    const tiktokOnly = homeFaqs.filter(({ q }) => q.includes('TikTok') && !q.includes('YouTube'))
    expect(tiktokOnly.map(({ q }) => q)).toEqual([])
  })

  it.each(LOCALES)('%s: the FAQPage JSON-LD is the visible text', (locale) => {
    const { mainEntity } = nodeOf(homepageStructuredData(locale), 'FAQPage') as unknown as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(
      contentFor(locale).homeFaqs,
    )
  })
})

describe('infoStructuredData', () => {
  it('places /pro, /privacy and /terms in the site with a trail home, in every locale', () => {
    for (const locale of LOCALES) {
      for (const page of ['pro', 'privacy', 'terms'] as const) {
        const graph = infoStructuredData(page, locale)['@graph'] as Array<Record<string, unknown>>
        const webPage = graph.find((n) => n['@type'] === 'WebPage')!
        const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList')!
        expect(webPage.url).toMatch(new RegExp(`/${page}$`))
        expect(webPage.inLanguage).toBe(locale)
        expect(webPage.name).toBeTruthy()
        // These pages render no share card of their own to point at.
        expect(webPage).not.toHaveProperty('primaryImageOfPage')
        expect(webPage.breadcrumb).toEqual({ '@id': crumbs['@id'] })
        const items = crumbs.itemListElement as Array<{ name: string; item: string }>
        expect(items).toHaveLength(2)
        expect(items[1].item).toBe(webPage.url)
        expect(items.every((i) => i.name.length > 0)).toBe(true)
      }
    }
  })
})
