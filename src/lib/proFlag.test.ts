import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRO_ATTR, PROFILE_CACHE_KEY, proBootSource, tierFrom } from './proFlag'

function boot(cookie: string, cached: unknown) {
  const attrs = new Set<string>()
  const doc = { cookie, documentElement: { setAttribute: (name: string) => attrs.add(name) } }
  const store = {
    getItem: (key: string) =>
      key === PROFILE_CACHE_KEY && cached !== undefined ? JSON.stringify(cached) : null,
  }
  new Function(`return (${proBootSource})`)()(doc, store)
  return attrs.has(PRO_ATTR)
}

describe('head script', () => {
  it('marks a signed-in supporter before paint', () => {
    expect(boot('a=1; smd_account=1', { pro: true })).toBe(true)
  })
  it('leaves a free account, a signed-out browser and a stale cache unmarked', () => {
    expect(boot('smd_account=1', { pro: false })).toBe(false)
    expect(boot('', { pro: true })).toBe(false)
    expect(boot('smd_account=0', { pro: true })).toBe(false)
    expect(boot('smd_account=1', undefined)).toBe(false)
  })
  it('never throws on a corrupt cache', () => {
    const doc = { cookie: 'smd_account=1', documentElement: { setAttribute: () => {} } }
    const store = { getItem: () => '{nope' }
    expect(() => new Function(`return (${proBootSource})`)()(doc, store)).not.toThrow()
  })
})

describe('tierFrom', () => {
  it('trusts the boot mark until the server answers', () => {
    expect(tierFrom({ signedIn: undefined, pro: false }, true)).toBe('pro')
    expect(tierFrom({ signedIn: undefined, pro: false }, false)).toBe('free')
  })
  it('lets the server answer overrule the mark', () => {
    expect(tierFrom({ signedIn: true, pro: false }, true)).toBe('free')
    expect(tierFrom({ signedIn: false, pro: false }, true)).toBe('free')
    expect(tierFrom({ signedIn: true, pro: true }, false)).toBe('pro')
  })
})

// The pieces that make the mark do anything. Each one missing brings the
// supporter's refresh shift back, and none of them can fail a type check.
describe('wiring', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  it('runs the script in <head> and hides free-only elements under the mark', () => {
    expect(src('app/layout.tsx')).toMatch(/__html: proFlagScript/)
    expect(src('app/globals.css')).toMatch(/html\[data-pro\] \[data-free-only\]\s*\{\s*display: none !important/)
  })
  it('re-syncs the mark with every server answer', () => {
    expect(src('lib/account.ts')).toMatch(/syncProFlag\(/)
    expect(src('lib/entitlements.ts')).toMatch(/tierFrom\(/)
  })
  it.each([
    'components/ProNudge.tsx',
    'components/SupportPanel.tsx',
    'components/PromoSlot.tsx',
  ])('%s marks its free-only element', (file) => {
    expect(src(file)).toMatch(/data-free-only/)
  })
  it('keeps the batch queue in the static HTML as a supporter-only bar', () => {
    // The lazy panel popping in on load pushed the rest of the page down.
    expect(src('app/globals.css')).toMatch(/html:not\(\[data-pro\]\) \[data-pro-only\]\s*\{\s*display: none !important/)
    const app = src('components/DownloaderApp.tsx')
    const bar = app.slice(app.indexOf('function ProBatchPanel'))
    expect(bar).toMatch(/data-pro-only/)
    expect(bar).toMatch(/open && tier === 'pro'/)
  })
})
