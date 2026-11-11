import { describe, expect, it } from 'vitest'
import { createPacer } from './request-pacer.mjs'

/** A clock that only moves when the pacer sleeps. */
function fakeClock() {
  let t = 0
  return {
    now: () => t,
    sleep: async (ms) => {
      t += ms
    },
  }
}

describe('createPacer', () => {
  it('lets the first `limit` requests through without waiting', async () => {
    const clock = fakeClock()
    const pace = createPacer({ limit: 3, windowMs: 10_000, ...clock })
    for (let i = 0; i < 3; i++) await pace()
    expect(clock.now()).toBe(0)
  })

  it('holds the next request until the oldest leaves the window', async () => {
    const clock = fakeClock()
    const pace = createPacer({ limit: 3, windowMs: 10_000, ...clock })
    for (let i = 0; i < 4; i++) await pace()
    expect(clock.now()).toBe(10_000)
  })

  it('never lets more than `limit` start inside any window, even concurrently', async () => {
    // The smoke runs 6 workers at once; 2026-11-11 pass 2 tripped the zone's
    // 30-per-10s rule on /api/download and got Cloudflare's HTML 429.
    const clock = fakeClock()
    const pace = createPacer({ limit: 24, windowMs: 10_000, ...clock })
    const starts = []
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let i = 0; i < 20; i++) {
          await pace()
          starts.push(clock.now())
        }
      })
    )
    expect(starts).toHaveLength(120)
    for (const start of starts) {
      const inWindow = starts.filter((s) => s >= start && s < start + 10_000)
      expect(inWindow.length).toBeLessThanOrEqual(24)
    }
  })
})
