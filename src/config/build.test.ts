import { describe, expect, it } from 'vitest'
import { buildDate, lastChanged } from './build'

describe('lastChanged', () => {
  it('reads the commit date, not the clock', () => {
    expect(lastChanged(['LICENSE']).getTime()).toBeLessThan(buildDate.getTime())
  })

  it('falls back to the build date for a path git has never seen', () => {
    expect(lastChanged(['no/such/file'])).toBe(buildDate)
  })
})
