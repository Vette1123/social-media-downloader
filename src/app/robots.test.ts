import { describe, expect, it } from 'vitest'
import robots from './robots'

describe('robots.txt', () => {
  const rules = [robots().rules].flat()
  const open = rules.filter((rule) => rule.allow === '/')

  it('keeps crawlers off every URL with nothing to index', () => {
    expect(open.length).toBeGreaterThan(0)
    for (const rule of open) {
      expect(rule.disallow).toEqual(
        expect.arrayContaining(['/api/', '/account', '/*/account', '/splash/']),
      )
    }
  })

  it('never disallows what search needs to render or read a page', () => {
    // /_next/ carries the CSS and JS, and /*/opengraph-image is listed in the
    // sitemap: blocking either costs more than the crawl it saves.
    for (const rule of open) {
      for (const path of [rule.disallow].flat()) {
        expect(path).not.toMatch(/_next|opengraph|^\/$/)
      }
    }
  })
})
