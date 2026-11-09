import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'

// public/_redirects turns Cloudflare's default 307 for a trailing slash into a
// 301, one rule per path depth (a placeholder matches one segment). A page
// deeper than the deepest rule would quietly fall back to the 307.
const rules = readFileSync('public/_redirects', 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/))

const depth = (path: string) => path.split('/').filter(Boolean).length

describe('trailing-slash redirects', () => {
  it('are permanent and strip only the slash', () => {
    expect(rules.length).toBeGreaterThan(0)
    for (const [from, to, status] of rules) {
      expect(status).toBe('301')
      expect(from).toBe(`${to}/`)
    }
  })

  it('cover every depth the sitemap publishes', () => {
    const covered = new Set(rules.map(([from]) => depth(from)))
    for (const { url } of sitemap()) {
      const path = new URL(url).pathname
      if (path !== '/') expect(covered, path).toContain(depth(path))
    }
  })
})
