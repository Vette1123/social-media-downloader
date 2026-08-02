import { describe, expect, it } from 'vitest'
import { safeRedirect } from './google'

const ORIGIN = 'https://example.com'

describe('safeRedirect', () => {
  it('defaults to the home page when nothing was requested', () => {
    expect(safeRedirect(null, ORIGIN)).toBe('/')
  })

  it('keeps a same-origin path', () => {
    expect(safeRedirect('/tiktok-downloader', ORIGIN)).toBe('/tiktok-downloader')
  })

  it('keeps a query string', () => {
    expect(safeRedirect('/account?checkout=success', ORIGIN)).toBe('/account?checkout=success')
  })

  it('accepts an absolute URL on our own origin, reduced to a path', () => {
    expect(safeRedirect(`${ORIGIN}/pro`, ORIGIN)).toBe('/pro')
  })

  it('rejects another origin', () => {
    expect(safeRedirect('https://evil.example/phish', ORIGIN)).toBe('/')
  })

  it('rejects a protocol-relative URL, which resolves off-origin', () => {
    expect(safeRedirect('//evil.example/phish', ORIGIN)).toBe('/')
  })

  it('collapses a path that climbs back into protocol-relative form', () => {
    // `/..//evil.example` resolves to a pathname of `//evil.example` on OUR
    // origin, so the origin check passes and the bare result would read as
    // protocol-relative all over again.
    expect(safeRedirect('/..//evil.example', ORIGIN)).toBe('/evil.example')
    expect(safeRedirect('/a/../..//evil.example', ORIGIN)).toBe('/evil.example')
  })

  it('rejects a javascript: URL', () => {
    expect(safeRedirect('javascript:alert(1)', ORIGIN)).toBe('/')
  })

  it('rejects a malformed target rather than throwing', () => {
    expect(safeRedirect('http://[', ORIGIN)).toBe('/')
  })

  it('drops any fragment', () => {
    expect(safeRedirect('/pro#pricing', ORIGIN)).toBe('/pro')
  })
})
