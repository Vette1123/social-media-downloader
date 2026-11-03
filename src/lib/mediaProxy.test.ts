import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAudioProxy, handleImageProxy, handleVideoProxy } from './mediaProxy'

const ask = (handler: (r: Request) => Promise<Response>) =>
  handler(new Request('https://x.space/api/x?url=' + encodeURIComponent('https://cdn.test/f')))

const upstream = (...answers: (number | Error)[]) => {
  const fetchMock = vi.fn(async () => {
    const next = answers.shift()!
    if (next instanceof Error) throw next
    return new Response(next < 400 ? 'bytes' : 'no', { status: next })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe.each([
  ['audio', handleAudioProxy],
  ['video', handleVideoProxy],
  ['image', handleImageProxy],
])('%s proxy when the upstream host refuses', (_name, handler) => {
  it('passes an expired-link 403 through instead of turning it into our 500', async () => {
    const fetchMock = upstream(403)
    expect((await ask(handler)).status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers 502 for an upstream 530, after one retry', async () => {
    const fetchMock = upstream(530, 530)
    expect((await ask(handler)).status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('answers 502 when the upstream connection drops', async () => {
    upstream(new Error('connection reset'), new Error('connection reset'))
    expect((await ask(handler)).status).toBe(502)
  })

  it('recovers when the retry succeeds', async () => {
    upstream(503, 200)
    expect((await ask(handler)).status).toBe(200)
  })
})
