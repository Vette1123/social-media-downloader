import { describe, expect, it } from 'vitest'
import { detectPlatform, extractLink, linkTokens, parseVideoId } from './validator'

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

// PostHog 2026-11-20: both shapes fell through to the generic Cobalt path and
// failed as "unsupported", skipping the extractors built for them.
describe('detectPlatform: share-sheet shapes that were landing in generic', () => {
  it('reads the letterless Facebook /share/<code> as Facebook', () => {
    expect(detectPlatform('https://www.facebook.com/share/1AbCdEfGh/')).toBe('facebook')
    expect(detectPlatform('https://www.facebook.com/share/1AbCdEfGh/?mibextid=wwXIfr')).toBe('facebook')
    expect(detectPlatform('https://www.facebook.com/share/')).toBe('generic')
  })

  it('reads a TikTok photo carousel as TikTok, with its id', () => {
    const url = 'https://www.tiktok.com/@someone/photo/7311111111111111111?_r=1'
    expect(detectPlatform(url)).toBe('tiktok')
    expect(parseVideoId(url)).toBe('7311111111111111111')
  })
  it('takes the first of several links pasted run together', () => {
    const a = 'https://www.tiktok.com/t/ZSaaaaaaa'
    const b = 'https://www.tiktok.com/t/ZSbbbbbbb'
    const c = 'https://vt.tiktok.com/ZScccccccc'
    expect(extractLink(`${a}${b}${c}`)).toBe(a)
    expect(extractLink(`${a}/${b}/${c}/`)).toBe(`${a}/`)
  })

  it('does not split a link that carries another link in its query', () => {
    const link = 'https://www.facebook.com/login/?next=https://www.facebook.com/reel/123'
    expect(extractLink(link)).toBe(link)
  })
})

describe('linkTokens', () => {
  it('splits links pasted with no space between them', () => {
    expect(linkTokens('https://a.com/xhttps://b.com/y http://c.com/z')).toEqual([
      'https://a.com/x',
      'https://b.com/y',
      'http://c.com/z',
    ])
  })
})

describe('author-less TikTok photo links', () => {
  it('is TikTok, as a /t/ short link lands on it', () => {
    expect(detectPlatform('https://www.tiktok.com/@/photo/7584709238878915858?_r=1')).toBe('tiktok')
    expect(parseVideoId('https://www.tiktok.com/@/photo/7584709238878915858')).toBe('7584709238878915858')
  })
})

describe('extractLink — redirect wrappers', () => {
  it('unwraps a Google search result link', () => {
    expect(
      extractLink(
        'https://www.google.com/url?sa=t&url=https%3A%2F%2Fwww.tiktok.com%2F%40a%2Fvideo%2F123&gsessionid=x',
      ),
    ).toBe('https://www.tiktok.com/@a/video/123')
  })

  it('unwraps Facebook, Instagram and YouTube outbound links', () => {
    expect(extractLink('https://l.facebook.com/l.php?u=https%3A%2F%2Fx.com%2Fa%2Fstatus%2F1&h=AT0')).toBe(
      'https://x.com/a/status/1',
    )
    expect(extractLink('https://l.instagram.com/?u=https%3A%2F%2Fyoutu.be%2Fabc&e=1')).toBe('https://youtu.be/abc')
    expect(
      extractLink('https://www.youtube.com/redirect?event=x&q=https%3A%2F%2Fvimeo.com%2F42'),
    ).toBe('https://vimeo.com/42')
  })

  // posthog-watch #83: `www|/*?url&gsessionid` reached the generic extractor as a
  // google.com link. A copied address bar drops the scheme, and `new URL` threw.
  it('unwraps a wrapper pasted without its scheme, and a target without one', () => {
    expect(extractLink('www.google.com/url?url=https%3A%2F%2Fwww.tiktok.com%2F%40a%2Fvideo%2F123&gsessionid=x')).toBe(
      'https://www.tiktok.com/@a/video/123',
    )
    expect(extractLink('l.facebook.com/l.php?u=https%3A%2F%2Fx.com%2Fa%2Fstatus%2F1')).toBe('https://x.com/a/status/1')
    expect(extractLink('https://www.google.com/url?url=www.instagram.com%2Freel%2FABC%2F')).toBe(
      'https://www.instagram.com/reel/ABC/',
    )
  })

  it('keeps a wrapper whose target is not a web link, and ordinary query links', () => {
    expect(extractLink('https://www.google.com/url?url=javascript%3Aalert(1)')).toBe(
      'https://www.google.com/url?url=javascript%3Aalert(1)',
    )
    expect(extractLink('https://www.youtube.com/watch?v=abc&url=https%3A%2F%2Fx.com')).toBe(
      'https://www.youtube.com/watch?v=abc&url=https%3A%2F%2Fx.com',
    )
  })
})
