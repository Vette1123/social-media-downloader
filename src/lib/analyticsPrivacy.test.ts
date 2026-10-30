import { describe, expect, it } from 'vitest'
import { contentLink, scrubEvent, scrubText, scrubUrl } from './analyticsPrivacy'

describe('scrubUrl', () => {
  it('drops the share-target link and keeps the path', () => {
    expect(
      scrubUrl('https://www.socialdownloader.space/?url=https%3A%2F%2Fa.com%2Fp%2F1'),
    ).toBe('https://www.socialdownloader.space/')
  })

  it('keeps campaign tags, and only those', () => {
    expect(scrubUrl('https://x.space/pro?text=secret&utm_source=mail')).toBe(
      'https://x.space/pro?utm_source=mail',
    )
  })

  it('drops a fragment', () => {
    expect(scrubUrl('https://x.space/a#https://a.com/p/1')).toBe('https://x.space/a')
  })

  it('leaves a URL with no query alone', () => {
    expect(scrubUrl('https://x.space/pro')).toBe('https://x.space/pro')
  })
})

describe('contentLink', () => {
  it('drops share tokens', () => {
    expect(contentLink('https://www.instagram.com/reel/abc/?igsh=TOKEN')).toBe(
      'https://www.instagram.com/reel/abc/',
    )
  })

  it('keeps the query value that IS the content id', () => {
    expect(contentLink('https://www.youtube.com/watch?v=abc&si=TOKEN&t=3')).toBe(
      'https://www.youtube.com/watch?v=abc',
    )
  })

  it('refuses something that is not a link', () => {
    expect(contentLink('not a link')).toBeUndefined()
  })
})

describe('scrubText', () => {
  it('replaces a quoted link', () => {
    expect(scrubText('Failed to fetch https://a.com/p/1?x=2 today')).toBe(
      'Failed to fetch <url> today',
    )
  })
})

describe('scrubEvent', () => {
  it('reaches every automatic place a link can sit', () => {
    const event = scrubEvent({
      properties: {
        $current_url: 'https://x.space/?url=secret',
        $exception_list: [{ value: 'bad https://a.com/secret' }],
        $exception_values: ['bad https://a.com/secret'],
      },
      $set_once: { $initial_current_url: 'https://x.space/?text=secret' },
    })
    expect(JSON.stringify(event)).not.toContain('secret')
  })
  it('leaves the deliberate download record alone', () => {
    const event = scrubEvent({
      properties: { content_url: 'https://a.com/watch?v=1' },
    })
    expect(event.properties?.content_url).toBe('https://a.com/watch?v=1')
  })
})
