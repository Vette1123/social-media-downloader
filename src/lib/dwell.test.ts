import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDwell } from './dwell'

describe('createDwell', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reports once after staying visible for the dwell', () => {
    const seen = vi.fn()
    const d = createDwell(seen, 1000)
    d.update(true)
    vi.advanceTimersByTime(999)
    expect(seen).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(seen).toHaveBeenCalledTimes(1)
    d.update(false)
    d.update(true)
    vi.advanceTimersByTime(5000)
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('does not count a scroll past shorter than the dwell', () => {
    const seen = vi.fn()
    const d = createDwell(seen, 1000)
    d.update(true)
    vi.advanceTimersByTime(600)
    d.update(false)
    vi.advanceTimersByTime(5000)
    expect(seen).not.toHaveBeenCalled()
  })

  it('stops cleanly on unmount', () => {
    const seen = vi.fn()
    const d = createDwell(seen, 1000)
    d.update(true)
    d.stop()
    vi.advanceTimersByTime(5000)
    expect(seen).not.toHaveBeenCalled()
  })
})
