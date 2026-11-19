import { describe, expect, it } from 'vitest'
import { batchSaveSources } from './batchSave'

const CDN = 'https://video-mrs2-3.xx.fbcdn.net/o1/clip.mp4'
const PROXY = '/api/video?url=x'

describe('batchSaveSources', () => {
  it('navigates only to an attachment URL', () => {
    expect(batchSaveSources({ directVideoUrl: CDN, directIsAttachment: true }, PROXY)).toEqual({
      navigate: CDN,
      fetch: [],
    })
  })

  it('reads a CDN file with fetch, then the proxy, instead of navigating to it', () => {
    expect(batchSaveSources({ directVideoUrl: CDN, directIsAttachment: false }, PROXY)).toEqual({
      fetch: [CDN, PROXY],
    })
  })

  it('treats an unstated attachment flag as not an attachment', () => {
    expect(batchSaveSources({ directVideoUrl: CDN }, PROXY)).toEqual({ fetch: [CDN, PROXY] })
  })

  it('falls back to the proxy alone', () => {
    expect(batchSaveSources(undefined, PROXY)).toEqual({ fetch: [PROXY] })
    expect(batchSaveSources(undefined, undefined)).toEqual({ fetch: [] })
  })
})
