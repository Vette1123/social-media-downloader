import { describe, expect, it } from 'vitest'
import { platforms } from './platforms'

// What a search result shows before it truncates.
const MAX_TITLE = 60
const MAX_DESCRIPTION = 160

describe('search snippets fit', () => {
  it.each(platforms.map((p) => [p.slug, p] as const))('%s', (_slug, platform) => {
    expect(platform.metaTitle.length).toBeLessThanOrEqual(MAX_TITLE)
    expect(platform.metaDescription.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
  })
})
