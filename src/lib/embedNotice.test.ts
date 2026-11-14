import { describe, expect, it } from 'vitest'

import { embedNotice } from './embedNotice'

describe('embedNotice', () => {
  it('warns on an embed with nothing to save', () => {
    expect(embedNotice({ hasEmbed: true, hasVideo: false, hasAudio: false })).toBe('play_only')
  })
  it('points at the MP3 when only the audio can be saved', () => {
    expect(embedNotice({ hasEmbed: true, hasVideo: false, hasAudio: true })).toBe('audio_only')
  })
  it('stays quiet when the video downloads or there is no embed', () => {
    expect(embedNotice({ hasEmbed: true, hasVideo: true, hasAudio: true })).toBeNull()
    expect(embedNotice({ hasEmbed: false, hasVideo: false, hasAudio: true })).toBeNull()
  })
})
