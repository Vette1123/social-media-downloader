import { describe, expect, it } from 'vitest'

import { slideshowRenderOffered } from './nativeMedia'

describe('slideshowRenderOffered', () => {
  // 23 people a week pressed a Slideshow button that could only answer 501.
  it('is not offered on the static Cloudflare deploy, where ffmpeg cannot run', () => {
    expect(slideshowRenderOffered('cloudflare')).toBe(false)
  })

  it('is offered everywhere ffmpeg can run', () => {
    expect(slideshowRenderOffered('')).toBe(true)
    expect(slideshowRenderOffered(undefined)).toBe(true)
  })
})
