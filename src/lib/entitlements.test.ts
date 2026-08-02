import { describe, expect, it } from 'vitest'
import { needsRevalidation } from './entitlements'
import { ACCESS_TOKEN_TTL_MS } from './proToken'

const NOW = 1_800_000_000_000

describe('needsRevalidation', () => {
  it('is false for a token freshly minted (a full TTL from expiry)', () => {
    expect(needsRevalidation(NOW + ACCESS_TOKEN_TTL_MS, NOW)).toBe(false)
  })

  it('is false just outside the revalidation margin', () => {
    const margin = ACCESS_TOKEN_TTL_MS / 4
    expect(needsRevalidation(NOW + margin + 1, NOW)).toBe(false)
  })

  it('is true right at the revalidation margin', () => {
    const margin = ACCESS_TOKEN_TTL_MS / 4
    expect(needsRevalidation(NOW + margin, NOW)).toBe(true)
  })

  it('is true well inside the margin', () => {
    expect(needsRevalidation(NOW + ACCESS_TOKEN_TTL_MS / 8, NOW)).toBe(true)
  })

  it('is true once the token has already expired', () => {
    expect(needsRevalidation(NOW - 1, NOW)).toBe(true)
  })
})
