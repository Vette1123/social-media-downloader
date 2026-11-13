import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  RECENT_ATTR,
  RECENT_HEIGHT_KEY,
  encodeRecentHeight,
  recentBootSource,
  recentReserveScript,
} from './recentReserve'

function boot(stored: string | null, innerWidth = 390) {
  const attrs = new Set<string>()
  const vars = new Map<string, string>()
  const doc = {
    documentElement: {
      setAttribute: (name: string) => attrs.add(name),
      style: { setProperty: (k: string, v: string) => vars.set(k, v) },
    },
  }
  const store = { getItem: (key: string) => (key === RECENT_HEIGHT_KEY ? stored : null) }
  new Function(`return (${recentBootSource})`)()({ document: doc, localStorage: store, innerWidth })
  return { marked: attrs.has(RECENT_ATTR), height: vars.get('--recent-h') }
}

describe('Recent reserve head script', () => {
  it('reserves the last measured height before paint', () => {
    expect(boot(encodeRecentHeight(390, 284))).toEqual({ marked: true, height: '284px' })
  })
  it('reserves nothing at another width, where the list would wrap differently', () => {
    expect(boot(encodeRecentHeight(390, 284), 1280).marked).toBe(false)
  })
  it('reserves nothing without a measurement or with garbage', () => {
    expect(boot(null).marked).toBe(false)
    expect(boot('nope').marked).toBe(false)
    expect(boot('390:0').marked).toBe(false)
    expect(boot('390:99999').marked).toBe(false)
  })
  it('never throws when the browser denies storage outright', () => {
    const w = { document: { documentElement: {} }, innerWidth: 390 }
    Object.defineProperty(w, 'localStorage', {
      get() {
        throw new Error('Access is denied for this document.')
      },
    })
    expect(() => new Function('window', recentReserveScript)(w)).not.toThrow()
  })
})

// None of these can fail a type check, and each one missing brings the
// returning visitor's refresh flash back.
describe('wiring', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  it('runs the script in <head> and shows the slot only under the mark', () => {
    expect(src('app/layout.tsx')).toMatch(/__html: recentReserveScript/)
    expect(src('app/globals.css')).toMatch(
      /html:not\(\[data-recent\]\) \[data-recent-slot\]\s*\{\s*display: none !important/,
    )
  })
  it('renders the slot until hydration and measures the list once shown', () => {
    const app = src('components/DownloaderApp.tsx')
    expect(app).toMatch(/!showRecent && !hydrated && \(\s*<div\s+data-recent-slot/)
    expect(app).toMatch(/rememberRecentHeight\(/)
    // A list already in storage at boot is not faded in on every refresh.
    expect(app).toMatch(/recentFadesIn \? 'animate-section-in' : ''/)
  })
  it('forgets the height when the list empties', () => {
    expect(src('lib/history.ts')).toMatch(/forgetRecentHeight\(\)/)
  })
})
