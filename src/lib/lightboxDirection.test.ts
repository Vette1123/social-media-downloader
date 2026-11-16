import { describe, expect, it } from 'vitest'
import { slideSign, stepForKey, stepForSwipe } from './lightboxDirection'

describe('lightbox direction', () => {
  it('ArrowRight is next in LTR and previous in RTL', () => {
    expect(stepForKey('ArrowRight', false)).toBe(1)
    expect(stepForKey('ArrowLeft', false)).toBe(-1)
    expect(stepForKey('ArrowRight', true)).toBe(-1)
    expect(stepForKey('ArrowLeft', true)).toBe(1)
    expect(stepForKey('Enter', true)).toBeNull()
  })

  it('a leftward swipe is next in LTR, previous in RTL', () => {
    expect(stepForSwipe(-120, 0, false, 80, 500)).toBe(1)
    expect(stepForSwipe(-120, 0, true, 80, 500)).toBe(-1)
    expect(stepForSwipe(0, 900, true, 80, 500)).toBe(1)
    expect(stepForSwipe(20, 10, true, 80, 500)).toBeNull()
  })

  it('the slide travels mirrored in RTL', () => {
    expect(slideSign(1, false)).toBe(1)
    expect(slideSign(1, true)).toBe(-1)
    expect(slideSign(0, true)).toBe(-0)
  })
})
