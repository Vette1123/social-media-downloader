import { describe, expect, it } from 'vitest'
import { signInHref, tokenIsUsable } from './account'

describe('signInHref', () => {
  it('points at the start endpoint with no destination', () => {
    expect(signInHref()).toBe('/api/auth/google')
  })

  it('carries an encoded destination', () => {
    expect(signInHref('/account?checkout=success')).toBe(
      '/api/auth/google?redirect_to=%2Faccount%3Fcheckout%3Dsuccess',
    )
  })
})

describe('tokenIsUsable', () => {
  const NOW = 1_800_000_000_000

  it('is false with no token', () => {
    expect(tokenIsUsable(null, NOW)).toBe(false)
  })

  it('is true for a token with time left', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 60_000 }, NOW)).toBe(true)
  })

  it('is false within the refresh margin, so a resolve never races expiry', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 10_000 }, NOW)).toBe(false)
  })

  it('is false once expired', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })
})
