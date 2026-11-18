import { describe, expect, it } from 'vitest'
import config from '../../next.config'

describe('client router cache', () => {
  it('keeps visited and prefetched pages for a session, not the 5 minute default', () => {
    const stale = config.experimental?.staleTimes
    expect(stale?.static).toBeGreaterThanOrEqual(1800)
    expect(stale?.dynamic).toBeGreaterThanOrEqual(300)
  })
})
