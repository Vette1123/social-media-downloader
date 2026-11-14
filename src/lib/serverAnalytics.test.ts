import { describe, expect, it, vi } from 'vitest'
import { reportServerFailure, serverFailureBatch } from './serverAnalytics'

describe('serverFailureBatch', () => {
  it('fingerprints by route and status, and never builds a person', () => {
    const { batch } = serverFailureBatch('phc_x', { route: '/api/download', status: 502 }, 'EG')
    expect(batch.map((e) => e.event)).toEqual(['server_error', '$exception'])
    expect(batch[0].properties.$process_person_profile).toBe(false)
    expect(batch[1].properties).toMatchObject({
      $exception_fingerprint: 'worker:/api/download:502',
    })
  })

  it('strips a link quoted in the error', () => {
    const body = serverFailureBatch(
      'phc_x',
      {
        route: '/api/download',
        status: 500,
        error: new Error('failed on https://a.com/secret'),
      },
      undefined,
    )
    expect(JSON.stringify(body)).not.toContain('secret')
  })
})

describe('reportServerFailure', () => {
  it('sends nothing without a key', () => {
    const waitUntil = vi.fn()
    reportServerFailure(
      new Request('https://x.space/api/download'),
      {},
      { waitUntil },
      { route: '/api/download', status: 500 },
    )
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('ignores 501: a deliberate refusal, sent to every deploy smoke test', () => {
    const waitUntil = vi.fn()
    reportServerFailure(
      new Request('https://x.space/api/youtube'),
      { POSTHOG_PROJECT_KEY: 'phc_x' },
      { waitUntil },
      { route: '/api/youtube', status: 501 },
    )
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('a caught 500 is reported with the reason its JSON body gave, scrubbed', async () => {
    const waitUntil = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    reportServerFailure(
      new Request('https://x.space/api/download'),
      { POSTHOG_PROJECT_KEY: 'phc_x' },
      { waitUntil },
      {
        route: '/api/download',
        status: 500,
        response: Response.json({ success: false, error: 'x is undefined at https://a.com/secret' }, { status: 500 }),
      },
    )
    await waitUntil.mock.calls[0][0]
    const sent = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(sent.batch[0].properties.message).toContain('x is undefined')
    expect(JSON.stringify(sent)).not.toContain('secret')
    expect(sent.batch[1].properties.$exception_fingerprint).toBe('worker:/api/download:500')
    fetchSpy.mockRestore()
  })

  it('a body that is not JSON still reports, as HTTP <status>', async () => {
    const waitUntil = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    reportServerFailure(
      new Request('https://x.space/api/download'),
      { POSTHOG_PROJECT_KEY: 'phc_x' },
      { waitUntil },
      { route: '/api/download', status: 500, response: new Response('<html>', { status: 500 }) },
    )
    await waitUntil.mock.calls[0][0]
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).batch[0].properties.message).toBe('HTTP 500')
    fetchSpy.mockRestore()
  })

  it('ignores 502: a proxy relaying that the upstream host failed', () => {
    const waitUntil = vi.fn()
    reportServerFailure(
      new Request('https://x.space/api/audio'),
      { POSTHOG_PROJECT_KEY: 'phc_x' },
      { waitUntil },
      { route: '/api/audio', status: 502 },
    )
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
