import { afterEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { handlePortal } from './portal'

/**
 * This endpoint is only ever reached by clicking a link, so every failure is
 * rendered by a browser. It used to answer them as JSON, which put a visitor
 * with no subscription on a blank page reading
 * `{"success":false,"error":"No subscription"}` with no way back to the site.
 */

// Never queried in these cases: `loadSession` returns at its null guard when
// the request carries no session cookie.
const env = { DB: {} as D1Database }

function portalRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://www.socialdownloader.space/api/billing/portal', { headers })
}

const NAVIGATION = { 'Sec-Fetch-Mode': 'navigate' }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('handlePortal failures', () => {
  it('sends a browser back to the account page with a reason', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
    const response = await handlePortal(portalRequest(NAVIGATION), undefined, env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://www.socialdownloader.space/account?billing=none',
    )
  })

  it('recognises a navigation from Accept alone', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
    const response = await handlePortal(
      portalRequest({ Accept: 'text/html,application/xhtml+xml' }),
      undefined,
      env,
    )

    expect(response.status).toBe(302)
  })

  it('still answers a programmatic caller with JSON', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'test-key')
    const response = await handlePortal(portalRequest({ Accept: 'application/json' }), undefined, env)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ success: false, error: 'No subscription' })
  })

  it('redirects rather than exposing an unconfigured deployment to a visitor', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', '')
    const response = await handlePortal(portalRequest(NAVIGATION), undefined, env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://www.socialdownloader.space/account?billing=unavailable',
    )
  })
})
