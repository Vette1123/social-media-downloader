import { describe, expect, it } from 'vitest'
import { featureCardFormat } from './featureCard'

describe('featureCardFormat', () => {
  it('only the MP3 card switches to audio', () => {
    expect(featureCardFormat('audio')).toBe('audio')
    expect(featureCardFormat('video')).toBe('video')
  })

  it('gallery and ZIP need a video resolve, never an MP3 of a photo post', () => {
    expect(featureCardFormat('gallery')).toBe('video')
    expect(featureCardFormat('zip')).toBe('video')
  })
})
