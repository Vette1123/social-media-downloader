import { describe, expect, it } from 'vitest'
import { CANCELLED_ERROR, type BatchItem } from './batchQueue'
import {
  categorizeResult,
  isCancelled,
  isZippable,
  rowStatusColorClass,
  rowStatusText,
} from './batchPresentation'
import type { ResolveResult } from './resolve'

function item(overrides: Partial<BatchItem>): BatchItem {
  return { url: 'https://example.com/x', status: 'queued', ...overrides }
}

describe('categorizeResult', () => {
  it('is "none" for an undefined result', () => {
    expect(categorizeResult(undefined)).toBe('none')
  })

  it('is "image" whenever the result carries images, regardless of isPhotoCarousel', () => {
    const withImages: ResolveResult = {
      success: true,
      metadata: { images: [{ id: '1', url: 'a', thumbnail: 'a', selected: false }] } as never,
    }
    expect(categorizeResult(withImages)).toBe('image')
  })

  it('is "video" when downloadUrl is set and there are no images', () => {
    const video: ResolveResult = { success: true, downloadUrl: 'https://cdn/video.mp4' }
    expect(categorizeResult(video)).toBe('video')
  })

  it('is "audio" when only audioUrl is set (batch requested audio-only)', () => {
    const audio: ResolveResult = { success: true, audioUrl: 'https://cdn/audio.mp3' }
    expect(categorizeResult(audio)).toBe('audio')
  })

  it('is "none" for an embed-only fallback with nothing downloadable', () => {
    const embedOnly: ResolveResult = {
      success: true,
      metadata: { embedUrl: 'https://youtube.com/embed/x' } as never,
    }
    expect(categorizeResult(embedOnly)).toBe('none')
  })
})

describe('isZippable', () => {
  it('is true only for image and audio', () => {
    expect(isZippable('image')).toBe(true)
    expect(isZippable('audio')).toBe(true)
    expect(isZippable('video')).toBe(false)
    expect(isZippable('none')).toBe(false)
  })
})

describe('isCancelled', () => {
  it('is true for a failed item carrying the CANCELLED_ERROR sentinel', () => {
    expect(isCancelled(item({ status: 'failed', error: CANCELLED_ERROR }))).toBe(true)
  })

  it('is false for a genuinely failed item', () => {
    expect(isCancelled(item({ status: 'failed', error: 'Network error' }))).toBe(false)
  })

  it('is false for a done item', () => {
    expect(isCancelled(item({ status: 'done' }))).toBe(false)
  })
})

describe('rowStatusText', () => {
  it('reads "Cancelled" for a cancelled item, not the raw sentinel', () => {
    expect(rowStatusText(item({ status: 'failed', error: CANCELLED_ERROR }))).toBe('Cancelled')
  })

  it('reads the real error text for a genuine failure', () => {
    expect(rowStatusText(item({ status: 'failed', error: 'boom' }))).toBe('boom')
  })

  it('reads "Done" for a finished video/image/audio item', () => {
    const done = item({ status: 'done', result: { success: true, downloadUrl: 'x' } })
    expect(rowStatusText(done)).toBe('Done')
  })

  it('reads a plain "nothing downloadable" note for a "none" result, not "Done"', () => {
    const doneButEmpty = item({ status: 'done', result: { success: true } })
    expect(rowStatusText(doneButEmpty)).toBe('No downloadable media')
  })
})

describe('rowStatusColorClass', () => {
  it('is neutral, not red, for a cancelled item', () => {
    const cancelled = item({ status: 'failed', error: CANCELLED_ERROR })
    expect(rowStatusColorClass(cancelled)).not.toContain('red')
  })

  it('is red for a genuine failure', () => {
    const failed = item({ status: 'failed', error: 'boom' })
    expect(rowStatusColorClass(failed)).toContain('red')
  })

  it('is neutral, not green, for a "none" result', () => {
    const doneButEmpty = item({ status: 'done', result: { success: true } })
    expect(rowStatusColorClass(doneButEmpty)).not.toContain('emerald')
  })

  it('is green for a real done result', () => {
    const done = item({ status: 'done', result: { success: true, downloadUrl: 'x' } })
    expect(rowStatusColorClass(done)).toContain('emerald')
  })
})
