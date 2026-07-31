import { describe, expect, it } from 'vitest'
import { resolveCacheKey } from './apiRoutes'

describe('resolveCacheKey', () => {
  it('produces different keys for the same inputs in different tiers', () => {
    const anon = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    const auth = resolveCacheKey('auth', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(anon).not.toBe(auth)
  })

  it('produces equal keys for identical inputs in the same tier', () => {
    const a = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    const b = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(a).toBe(b)
  })

  it('differs when any other input differs, holding tier constant', () => {
    const base = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(resolveCacheKey('anon', 'image', 'hd', 'auto', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'sd', 'auto', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'hd', 'audio', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/b')).not.toBe(base)
  })
})
