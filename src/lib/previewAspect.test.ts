import { describe, expect, it } from 'vitest'
import { previewAspectRatio } from './previewAspect'

describe('previewAspectRatio', () => {
  it('takes the thumbnail shape', () => {
    expect(previewAspectRatio(1080, 1350)).toBe('0.8 / 1')
    expect(previewAspectRatio(1280, 720)).toBe('1.778 / 1')
  })

  it('clamps strips to 9:16 and 16:9', () => {
    expect(previewAspectRatio(100, 1000)).toBe('0.563 / 1')
    expect(previewAspectRatio(3000, 100)).toBe('1.778 / 1')
  })

  it('falls back to 16:9 when the thumbnail size is unknown', () => {
    expect(previewAspectRatio()).toBe('16 / 9')
    expect(previewAspectRatio(0, 720)).toBe('16 / 9')
  })
})
