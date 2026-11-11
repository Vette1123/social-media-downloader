import { describe, expect, it } from 'vitest'
import { platformFor } from '@/lib/localeContent'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { PLATFORM_SLUGS } from '@/lib/platformSlugs'
import { platformStructuredData } from '@/lib/structuredData'

describe.each(['en', ...ROUTE_LOCALES] as const)('platform FAQ (%s)', (locale) => {
  it.each(PLATFORM_SLUGS.map((s) => [s] as const))('%s has 4-5 filled entries', (slug) => {
    const { faqs } = platformFor(locale, slug)
    expect(faqs.length).toBeGreaterThanOrEqual(4)
    expect(faqs.length).toBeLessThanOrEqual(5)
    for (const { q, a } of faqs) {
      expect(q.trim().length).toBeGreaterThan(0)
      expect(a.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(faqs.map((f) => f.q)).size).toBe(faqs.length)
  })

  it.each(PLATFORM_SLUGS.map((s) => [s] as const))('%s JSON-LD equals the page data', (slug) => {
    const graph = platformStructuredData(slug, locale)['@graph']
    const node = graph.find((n) => n['@type'] === 'FAQPage') as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(node.mainEntity.map((e) => [e.name, e.acceptedAnswer.text])).toEqual(
      platformFor(locale, slug).faqs.map((f) => [f.q, f.a]),
    )
  })
})
