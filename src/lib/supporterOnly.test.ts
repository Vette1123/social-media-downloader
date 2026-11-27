import { describe, expect, it } from 'vitest'
import { handleDownload } from './apiRoutes'
import { failureCode, isExpectedFailure } from './analyticsErrors'
import { friendlyError, offersVideoInstead } from './errorMessages'
import { EXPECTED_CODES } from '../../scripts/lib/posthog-watch-rules.mjs'
import { bodyForCaller, supporterOnlyReason, YOUTUBE_MP3_SUPPORTER } from './supporterOnly'

describe('supporterOnlyReason', () => {
  it('refuses YouTube MP3 to a visitor without a supporter token', () => {
    expect(supporterOnlyReason('youtube', 'audio', false)).toBe(YOUTUBE_MP3_SUPPORTER)
  })

  it('lets a supporter through, and leaves video and other platforms open', () => {
    expect(supporterOnlyReason('youtube', 'audio', true)).toBeNull()
    expect(supporterOnlyReason('youtube', 'auto', false)).toBeNull()
    expect(supporterOnlyReason('tiktok', 'audio', false)).toBeNull()
  })
})

describe('bodyForCaller', () => {
  const body = JSON.stringify({
    success: true,
    downloadUrl: '/api/proxy?v',
    audioUrl: '/api/audio?a',
    metadata: { title: 't', rawMusicUrl: 'https://a', directAudioUrl: 'https://b' },
  })

  it('takes every audio link out of a YouTube result for a free visitor', () => {
    const out = JSON.parse(bodyForCaller(body, 'youtube', false))
    expect(out.audioUrl).toBeUndefined()
    expect(out.metadata.rawMusicUrl).toBeUndefined()
    expect(out.metadata.directAudioUrl).toBeUndefined()
    expect(out.downloadUrl).toBe('/api/proxy?v')
    expect(out.metadata.title).toBe('t')
  })

  it('returns the body untouched for a supporter or another platform', () => {
    expect(bodyForCaller(body, 'youtube', true)).toBe(body)
    expect(bodyForCaller(body, 'tiktok', false)).toBe(body)
  })
})

describe('handleDownload: YouTube MP3', () => {
  it('answers 403 with the supporter message when no token is sent', async () => {
    const request = new Request('https://example.com/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', format: 'audio' }),
    })
    const response = await handleDownload(request)
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe(YOUTUBE_MP3_SUPPORTER)
  })
})

describe('the refusal as the visitor and the board see it', () => {
  it('is an expected "supporter" failure, never an upstream fault', () => {
    expect(failureCode(YOUTUBE_MP3_SUPPORTER)).toBe('supporter')
    expect(isExpectedFailure('supporter')).toBe(true)
    // Or the issue watcher counts every refused free visitor as our fault.
    expect(EXPECTED_CODES).toContain('supporter')
  })

  it('reads as a supporter feature with no retry offered', () => {
    const friendly = friendlyError(YOUTUBE_MP3_SUPPORTER, 'https://youtu.be/dQw4w9WgXcQ')
    expect(friendly.title).toBe('MP3 from YouTube is for supporters')
    expect(friendly.retry).toBe('no')
  })

  it('offers the same link as a video, and only for this refusal', () => {
    // One visitor re-pasted a Short 27 times against a remembered MP3 choice.
    expect(offersVideoInstead(YOUTUBE_MP3_SUPPORTER)).toBe(true)
    expect(offersVideoInstead('This post may be private or unavailable')).toBe(false)
    expect(offersVideoInstead(undefined)).toBe(false)
  })
})
