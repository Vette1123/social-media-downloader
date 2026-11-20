import { describe, expect, it } from 'vitest'
import { IMAGE_SAVE_GAP_MS, gallerySaveOutcome, imageSaveStep, isConnectionDrop } from './imageSaves'

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

describe('gallerySaveOutcome', () => {
  // The loops used to report "5 images saved" off the selection size, so a run
  // of expired links wrote nothing and still said every file had landed.
  it('calls nothing saved a failure', () => {
    expect(gallerySaveOutcome(0, 5)).toBe('none')
  })

  it('tells a partial run apart from a full one', () => {
    expect(gallerySaveOutcome(3, 5)).toBe('some')
    expect(gallerySaveOutcome(5, 5)).toBe('all')
  })
})

describe('isConnectionDrop', () => {
  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
    'stops the run on "%s"',
    (message) => {
      expect(isConnectionDrop(new TypeError(message))).toBe(true)
    },
  )

  it('keeps going past a bad file', () => {
    expect(isConnectionDrop(new Error('HTTP 403'))).toBe(false)
    expect(isConnectionDrop(new TypeError("Cannot read properties of undefined (reading 'blob')"))).toBe(false)
    expect(isConnectionDrop('Failed to fetch')).toBe(false)
  })
})
