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
})
