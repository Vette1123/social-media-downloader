import { describe, expect, it } from 'vitest'
import crawlers from './crawlers.json'

/**
 * The crawler policy is read by two things that cannot see each other:
 * src/app/robots.tsx renders it into out/robots.txt at build time, and
 * scripts/cf-setup.mjs turns it into Cloudflare WAF rules over the API.
 *
 * The failure this guards is silent in both directions — a name that ends up in
 * two lists means the site invites a crawler and blocks it at the edge, and
 * nothing reports that except the traffic not arriving. `pnpm cf:health` catches
 * it after the fact; this catches it before the commit.
 */
describe('crawler policy', () => {
  const allowed = [
    ...crawlers.searchCrawlers,
    ...crawlers.aiCrawlers,
    ...crawlers.unfurlers,
    ...crawlers.robotsOnlyTokens,
  ]

  it('never allows and disallows the same crawler', () => {
    // Substring matching on both sides: Cloudflare uses `http.user_agent
    // contains`, so "Bingbot" in one list and "bingbot" in the other would be
    // two different rules matching one client. Compared case-insensitively for
    // that reason.
    const lower = (list: string[]) => list.map((name) => name.toLowerCase())
    const overlap = lower(crawlers.disallowedScrapers).filter((name) => lower(allowed).includes(name))
    expect(overlap).toEqual([])
  })

  // `_comment` is prose, not policy — it holds blank lines on purpose.
  const policyLists = Object.entries(crawlers).filter(
    ([name, list]) => name !== '_comment' && Array.isArray(list),
  ) as [string, string[]][]

  it('has no duplicates within a list', () => {
    for (const [name, list] of policyLists) {
      expect(new Set(list).size, `${name} has a repeated entry`).toBe(list.length)
    }
  })

  it('keeps every entry a bare user-agent token', () => {
    // These strings are interpolated into a Cloudflare rule expression as
    // `http.user_agent contains "<name>"`, and emitted verbatim as robots.txt
    // `User-Agent:` lines. A quote would break the expression; a newline would
    // forge a second robots.txt directive.
    for (const [name, list] of policyLists) {
      for (const entry of list) {
        expect(entry, `${name}: ${entry}`).not.toMatch(/["\n\r\\]/)
        expect(entry.trim(), `${name}: ${entry}`).toBe(entry)
        expect(entry.length).toBeGreaterThan(0)
      }
    }
  })

  it('still names the crawlers the site depends on', () => {
    // A regression here is an unindexed site, so the load-bearing few are
    // asserted by name rather than trusted to a review.
    expect(crawlers.searchCrawlers).toContain('Googlebot')
    expect(crawlers.searchCrawlers).toContain('bingbot')
    expect(crawlers.unfurlers).toContain('facebookexternalhit')
    expect(crawlers.unfurlers).toContain('WhatsApp')
  })
})
