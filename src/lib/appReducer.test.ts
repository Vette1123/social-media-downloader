import { describe, expect, it } from 'vitest'
import { autoOpensPreview, isSuccessMessage } from './appReducer'

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

/**
 * Two things read this: the status banner picks green or red, and the
 * post-download Pro nudge only appears after something actually saved. A false
 * positive shows a paying-customer pitch under a failure message.
 */
describe('isSuccessMessage', () => {
  it.each([
    'Video downloaded successfully! 🎉',
    'Download started. Check your downloads. 🎉',
    'Slideshow video rendered and downloaded! 🎬',
    'Audio extracted 🎵',
    '3 image(s) downloaded individually! 🖼️',
    'Saved 2 of 3 links to Recent — tap any to download. 🎉',
  ])('reads %s as a win', (message) => {
    expect(isSuccessMessage(message)).toBe(true)
  })

  it.each([
    'Failed to download video file',
    'Couldn’t resolve any of those 3 links. Check they’re public post URLs and try again.',
    'Preparing your download…',
    'Rendering slideshow video... this takes ~30 seconds.',
    '',
  ])('reads %s as not a win', (message) => {
    expect(isSuccessMessage(message)).toBe(false)
  })
})
