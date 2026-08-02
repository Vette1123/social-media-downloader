import { describe, expect, it } from 'vitest'
import { autoOpensPreview } from './appReducer'

const base = {
  platform: 'tiktok' as const,
  hasVideo: true,
  hasEmbed: false,
  isCarousel: false,
}

describe('autoOpensPreview', () => {
  it('opens for a known platform with a downloadable video', () => {
    expect(autoOpensPreview(base)).toBe(true)
  })

  it('stays shut for a generic link', () => {
    // The route unknown hosts arrive on: we do not paint a full-size poster
    // frame for content we know nothing about.
    expect(autoOpensPreview({ ...base, platform: 'generic' })).toBe(false)
  })

  it('stays shut when the platform is missing', () => {
    expect(autoOpensPreview({ ...base, platform: undefined })).toBe(false)
  })

  it('stays shut for an embed, which would load the third-party player', () => {
    expect(
      autoOpensPreview({ ...base, platform: 'youtube', hasEmbed: true }),
    ).toBe(false)
  })

  it('stays shut for a carousel, which has no video to preview', () => {
    expect(autoOpensPreview({ ...base, isCarousel: true })).toBe(false)
  })

  it('stays shut when there is nothing to play', () => {
    expect(autoOpensPreview({ ...base, hasVideo: false })).toBe(false)
  })

  it('keeps generic shut even when every other signal says open', () => {
    // Guards the ordering: `generic` must not be rescued by hasVideo.
    expect(
      autoOpensPreview({
        platform: 'generic',
        hasVideo: true,
        hasEmbed: false,
        isCarousel: false,
      }),
    ).toBe(false)
  })
})
