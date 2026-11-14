import { describe, expect, it } from 'vitest'
import { createFailureStreak } from './failureStreak'

describe('createFailureStreak', () => {
  it('counts repeats of one link and restarts on another', () => {
    const s = createFailureStreak()
    expect(s.count('a')).toBe(1)
    expect(s.count('a')).toBe(2)
    expect(s.count('b')).toBe(1)
    expect(s.count('a')).toBe(1)
  })

  it('a success resets the streak', () => {
    const s = createFailureStreak()
    s.count('a')
    s.count('a')
    s.reset()
    expect(s.count('a')).toBe(1)
  })
})
