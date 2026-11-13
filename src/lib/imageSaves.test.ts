import { describe, expect, it } from 'vitest'
import { IMAGE_SAVE_GAP_MS, imageSaveStep } from './imageSaves'

describe('imageSaveStep', () => {
  it('does not wait after a single image', () => {
    expect(imageSaveStep(0, 1)).toEqual({ pct: 100, pauseMs: 0 })
  })

  it('spaces files apart but not after the last one', () => {
    expect(imageSaveStep(0, 3)).toEqual({ pct: 33, pauseMs: IMAGE_SAVE_GAP_MS })
    expect(imageSaveStep(1, 3)).toEqual({ pct: 67, pauseMs: IMAGE_SAVE_GAP_MS })
    expect(imageSaveStep(2, 3)).toEqual({ pct: 100, pauseMs: 0 })
  })
})
