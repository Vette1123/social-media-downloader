import { describe, expect, it } from 'vitest'
import { handleDownload, resolveCacheKey, resolveFailure } from './apiRoutes'

describe('resolveCacheKey', () => {
  it('produces different keys for the same inputs in different tiers', () => {
    const anon = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    const auth = resolveCacheKey('auth', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(anon).not.toBe(auth)
  })

  it('produces equal keys for identical inputs in the same tier', () => {
    const a = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    const b = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(a).toBe(b)
  })

  it('differs when any other input differs, holding tier constant', () => {
    const base = resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/a')
    expect(resolveCacheKey('anon', 'image', 'hd', 'auto', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'sd', 'auto', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'hd', 'audio', 'https://x.com/a')).not.toBe(base)
    expect(resolveCacheKey('anon', 'video', 'hd', 'auto', 'https://x.com/b')).not.toBe(base)
  })
})

/**
 * A private Instagram post is not a server fault, and answering it with 500
 * made a healthy day of people pasting private links read as seventeen
 * server errors in Cloudflare's dashboard — burying anything real.
 */
describe('handleDownload failure statuses', () => {
  async function statusFor(url: string): Promise<number> {
    const request = new Request('https://example.com/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const response = await handleDownload(request)
    return response.status
  }

  it('rejects a missing url as a client error', async () => {
    expect(await statusFor('')).toBe(400)
  })

  it('rejects a string that is not a url as a client error', async () => {
    // Rejected by validateUrl before any extractor runs, so this case makes no
    // network call. Anything that does reach an extractor is covered by the
    // resolveFailure cases below instead.
    expect(await statusFor('not a url at all')).toBe(400)
  })
})

describe('resolveFailure', () => {
  it('calls a deliberate extraction failure unprocessable, not broken', () => {
    expect(resolveFailure(new Error('This post is private'), 'x').status).toBe(422)
  })

  it('keeps 500 for a genuine bug, so it still shows up as one', () => {
    // What reading a property of undefined throws. If this ever became 422,
    // real exceptions would hide among the private-link noise.
    expect(resolveFailure(new TypeError('undefined is not an object'), 'x').status).toBe(500)
  })

  it('calls an upstream that never answered a gateway timeout', () => {
    const aborted = new Error('The operation was aborted')
    aborted.name = 'AbortError'
    expect(resolveFailure(aborted, 'x').status).toBe(504)
  })

  it('treats a site that blocks us as content, not a fault', () => {
    const blocked = new Error('example.com blocks automated requests')
    blocked.name = 'OriginBlockedError'
    expect(resolveFailure(blocked, 'x').status).toBe(422)
  })

  it('keeps the extractor message, which the client turns into its banner', async () => {
    const response = resolveFailure(new Error('This post is private'), 'fallback')
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'This post is private',
    })
  })

  it('falls back when something that is not an Error is thrown', async () => {
    const response = resolveFailure('a bare string', 'fallback')
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ success: false, error: 'fallback' })
  })
})
