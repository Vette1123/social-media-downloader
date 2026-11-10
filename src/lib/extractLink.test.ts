import { describe, expect, it } from 'vitest'
import { detectPlatform, extractLink } from './validator'

describe('extractLink', () => {
  it('leaves a single link alone', () => {
    expect(extractLink('https://www.instagram.com/reel/Cabc123/')).toBe(
      'https://www.instagram.com/reel/Cabc123/',
    )
  })

  it('finds the link inside shared text', () => {
    const link = extractLink('Look at this https://vm.tiktok.com/ZMabc123/ so funny')
    expect(link).toBe('https://vm.tiktok.com/ZMabc123/')
    expect(detectPlatform(link!)).not.toBe('unknown')
  })

  it('drops a closing bracket and sentence punctuation', () => {
    expect(extractLink('(see https://x.com/a/status/123).')).toBe('https://x.com/a/status/123')
  })

  it('adds a scheme to a pasted address with none', () => {
    expect(extractLink('check www.dailymotion.com/video/x8abc please')).toBe(
      'https://www.dailymotion.com/video/x8abc',
    )
    expect(extractLink('pin.it/abc123 nice')).toBe('https://pin.it/abc123')
  })

  it('returns null for plain text', () => {
    expect(extractLink('hello world')).toBeNull()
    expect(extractLink('it works. really')).toBeNull()
    expect(extractLink('')).toBeNull()
  })

  it('makes shared text a valid input where it was unknown before', () => {
    expect(detectPlatform('Look at this https://x.com/a/status/123')).toBe('unknown')
    expect(detectPlatform(extractLink('Look at this https://x.com/a/status/123')!)).toBe(
      'twitter',
    )
  })
})

describe('detectPlatform: Snapchat share links', () => {
  it('knows the @user/spotlight link the Snapchat app shares', () => {
    // 2026-11-10: every such link was labelled "generic", so Snapchat's own
    // failures were counted under the generic catch-all.
    expect(
      detectPlatform(
        'https://www.snapchat.com/@rominagafur/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYYmR4a2pyY3NtAZbAPRICAZbAPQI3AAAAAQ',
      ),
    ).toBe('snapchat')
    expect(detectPlatform('https://www.snapchat.com/spotlight/W7_abc')).toBe('snapchat')
  })
})
