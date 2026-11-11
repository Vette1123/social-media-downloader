import { describe, expect, it } from 'vitest'
import { contentFor } from '@/lib/localeContent'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'

// What a search result shows before it truncates, and the floor below which a
// description wastes the room Google gives it.
const MAX_TITLE = 60
const MIN_DESCRIPTION = 140
const MAX_DESCRIPTION = 160

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
