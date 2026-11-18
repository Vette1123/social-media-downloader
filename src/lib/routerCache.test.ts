import { describe, expect, it } from 'vitest'
import config from '../../next.config'

describe('client router cache', () => {
  it('keeps visited and prefetched pages for a session, not the 5 minute default', () => {
    const stale = config.experimental?.staleTimes
    expect(stale?.static).toBe(7200) // 2 h; under a day so an open tab picks up a deploy
    expect(stale?.dynamic).toBe(1800)
  })
})
