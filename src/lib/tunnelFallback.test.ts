import { describe, expect, it } from 'vitest'
import { wantsTikwmFallback } from './tunnelFallback'

const tunnel = { platform: 'tiktok', directIsAttachment: true } as const

describe('wantsTikwmFallback', () => {
  // 2026-11-18: co.otomir23.me answered 500 after ~6.5 s on 5 of 14 real
  // TikTok links, and the failed tunnel went to the browser's downloader
  // logged as a success. tikwm served all of them.
  it('retries a failed or stalled TikTok tunnel from tikwm', () => {
    expect(wantsTikwmFallback('failed', tunnel)).toBe(true)
    expect(wantsTikwmFallback('too-big', tunnel)).toBe(true)
  })

  it('leaves a saved download alone', () => {
    expect(wantsTikwmFallback('saved', tunnel)).toBe(false)
  })

  it('never loops on a tikwm result (a raw CDN URL, not an attachment)', () => {
    expect(wantsTikwmFallback('failed', { platform: 'tiktok', directIsAttachment: false })).toBe(false)
  })

  it('is TikTok only', () => {
    expect(wantsTikwmFallback('failed', { platform: 'instagram', directIsAttachment: true })).toBe(false)
    expect(wantsTikwmFallback('failed', undefined)).toBe(false)
  })
})
