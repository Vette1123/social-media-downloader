import { describe, expect, it } from 'vitest'
import { contentFor } from '@/lib/localeContent'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { infoMetadata } from '@/lib/pageMetadata'

// What a search result shows before it truncates, and the floor below which a
// description wastes the room Google gives it.
const MAX_TITLE = 60
const MIN_DESCRIPTION = 140
const MAX_DESCRIPTION = 160
// Info pages (pro, privacy, terms) are shorter copy, but 120 is the floor the page audit holds.
const MIN_INFO_DESCRIPTION = 120

describe.each(['en', ...ROUTE_LOCALES] as const)('search snippets fit (%s)', (locale) => {
  it.each(contentFor(locale).platforms.map((p) => [p.slug, p] as const))(
    '%s',
    (_slug, platform) => {
      expect(platform.metaTitle.length, platform.metaTitle).toBeLessThanOrEqual(MAX_TITLE)
      expect(platform.metaDescription.length, platform.metaDescription).toBeGreaterThanOrEqual(
        MIN_DESCRIPTION,
      )
      expect(platform.metaDescription.length, platform.metaDescription).toBeLessThanOrEqual(
        MAX_DESCRIPTION,
      )
    },
  )
})

// /pro, /privacy and /terms: the description is filled with the site name before
// it ships, so measure the rendered text, not the template.
describe.each(['en', ...ROUTE_LOCALES] as const)('info page snippets fit (%s)', (locale) => {
  it.each(['pro', 'privacy', 'terms'] as const)('%s', (page) => {
    const meta = infoMetadata(page, locale)
    const title = typeof meta.title === 'string' ? meta.title : ''
    expect(title.length, title).toBeLessThanOrEqual(MAX_TITLE)
    expect(meta.description?.length, meta.description ?? '').toBeGreaterThanOrEqual(MIN_INFO_DESCRIPTION)
    expect(meta.description?.length, meta.description ?? '').toBeLessThanOrEqual(MAX_DESCRIPTION)
  })
})
