import { afterEach, describe, expect, it, vi } from 'vitest'
import { signInHref, tokenIsUsable } from './account'

describe('signInHref', () => {
  it('points at the start endpoint with no destination', () => {
    expect(signInHref()).toBe('/api/auth/google')
  })

  it('carries an encoded destination', () => {
    expect(signInHref('/account?checkout=success')).toBe(
      '/api/auth/google?redirect_to=%2Faccount%3Fcheckout%3Dsuccess',
    )
  })
})

describe('tokenIsUsable', () => {
  const NOW = 1_800_000_000_000

  it('is false with no token', () => {
    expect(tokenIsUsable(null, NOW)).toBe(false)
  })

  it('is true for a token with time left', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 60_000 }, NOW)).toBe(true)
  })

  it('is false within the refresh margin, so a resolve never races expiry', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW + 10_000 }, NOW)).toBe(false)
  })

  it('is false once expired', () => {
    expect(tokenIsUsable({ token: 'x', expiresAt: NOW - 1 }, NOW)).toBe(false)
  })
})

/**
 * The store keeps module-level state, so every case re-imports it fresh.
 * `refreshAccount` is driven through a stubbed `fetch`; nothing here renders.
 */
const PRO_BODY = {
  success: true,
  token: 'access-token',
  expiresAt: 4_000_000_000_000,
  userId: 'user-uuid',
  pro: true,
  email: 'buyer@example.com',
  name: 'Amira Halabi',
  picture: 'https://lh3.googleusercontent.com/a/abc123',
  plan: { status: 'active', variant: 'annual', renewsAt: null, endsAt: null, pastDueSince: null },
  // Present so the success path never falls through to persisting prefs.
  prefs: '{"quality":"hd","format":"video"}',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function loadStore() {
  vi.resetModules()
  return import('./account')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the account store', () => {
  it('starts out unknown, so the page never flashes the signed-out prompt', async () => {
    const { accountSnapshot } = await loadStore()
    expect(accountSnapshot()).toMatchObject({ signedIn: undefined, failed: false, pro: false })
  })

  it('adopts the account, including the id a checkout has to carry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, PRO_BODY)))
    const { accountSnapshot, currentAccessToken, refreshAccount } = await loadStore()

    await refreshAccount()

    expect(accountSnapshot()).toMatchObject({
      signedIn: true,
      failed: false,
      userId: 'user-uuid',
      pro: true,
      email: 'buyer@example.com',
    })
    expect(currentAccessToken()).toBe('access-token')
  })

  it('clears everything on an explicit 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, PRO_BODY))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: 'Not signed in' }))
    vi.stubGlobal('fetch', fetchMock)
    const { accountSnapshot, currentAccessToken, refreshAccount } = await loadStore()

    await refreshAccount()
    await refreshAccount({ force: true })

    expect(accountSnapshot()).toMatchObject({
      signedIn: false,
      failed: false,
      userId: null,
      pro: false,
      email: null,
      plan: null,
    })
    expect(currentAccessToken()).toBeNull()
  })

  it('never downgrades a Pro account because the network failed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, PRO_BODY))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const { accountSnapshot, currentAccessToken, refreshAccount } = await loadStore()

    await refreshAccount()
    await refreshAccount({ force: true })

    expect(accountSnapshot()).toMatchObject({ signedIn: true, pro: true, failed: true })
    expect(currentAccessToken()).toBe('access-token')
  })

  it('surfaces a 503 as a failure rather than an endless skeleton', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(503, { success: false, error: 'not configured' })),
    )
    const { accountSnapshot, refreshAccount } = await loadStore()

    await refreshAccount()

    // Still `undefined`, not `false`: a 503 is not evidence of being signed out.
    expect(accountSnapshot()).toMatchObject({ signedIn: undefined, failed: true, pro: false })
  })

  it('recovers when a retry succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { success: false }))
      .mockResolvedValueOnce(jsonResponse(200, PRO_BODY))
    vi.stubGlobal('fetch', fetchMock)
    const { accountSnapshot, refreshAccount } = await loadStore()

    await refreshAccount()
    await refreshAccount()

    expect(accountSnapshot()).toMatchObject({ signedIn: true, failed: false, pro: true })
  })

  it('signs out locally even when the logout request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, PRO_BODY))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const { accountSnapshot, currentAccessToken, refreshAccount, signOut } = await loadStore()

    await refreshAccount()
    await signOut()

    expect(accountSnapshot()).toMatchObject({ signedIn: false, pro: false, failed: false })
    expect(currentAccessToken()).toBeNull()
  })
})

/**
 * The profile cache is what lets the top-right avatar paint on the first frame
 * without a request. Its whole risk is lifetime: a copy of someone's name and
 * photo that outlives their session would show the previous user of a shared
 * browser to the next one.
 */
describe('the profile cache', () => {
  function stubLocalStorage(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial))
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    })
    return store
  }

  it('caches who is signed in after a successful refresh', async () => {
    const store = stubLocalStorage()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, PRO_BODY)))
    const { cachedProfile, refreshAccount } = await loadStore()

    await refreshAccount()

    expect(cachedProfile()).toEqual({
      email: 'buyer@example.com',
      name: 'Amira Halabi',
      picture: 'https://lh3.googleusercontent.com/a/abc123',
      pro: true,
    })
    // The access token and the account id are deliberately absent: this is
    // display data, and nothing here may be mistakable for a credential.
    expect(store.get('smd_profile')).not.toContain('access-token')
    expect(store.get('smd_profile')).not.toContain('user-uuid')
  })

  it('erases the cache on sign-out', async () => {
    stubLocalStorage()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, PRO_BODY)))
    const { cachedProfile, refreshAccount, signOut } = await loadStore()

    await refreshAccount()
    await signOut()

    expect(cachedProfile()).toBeNull()
  })

  it('erases a cache left behind by an expired session', async () => {
    // The hint cookie is gone but localStorage is not, which is exactly the
    // state a 90-day cookie expiring produces.
    stubLocalStorage({ smd_profile: '{"email":"stale@example.com","pro":true}' })
    const { cachedProfile, markSignedOut } = await loadStore()

    markSignedOut()

    expect(cachedProfile()).toBeNull()
  })

  it('erases the cache when the server says the session is gone', async () => {
    stubLocalStorage()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, PRO_BODY))
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
    vi.stubGlobal('fetch', fetchMock)
    const { cachedProfile, refreshAccount } = await loadStore()

    await refreshAccount()
    await refreshAccount({ force: true })

    expect(cachedProfile()).toBeNull()
  })

  it('survives junk in storage rather than taking the page down', async () => {
    stubLocalStorage({ smd_profile: 'not json' })
    const { cachedProfile } = await loadStore()

    expect(cachedProfile()).toBeNull()
  })

  it('ignores a cached entry with the wrong shape', async () => {
    stubLocalStorage({ smd_profile: '{"email":42,"pro":"yes"}' })
    const { cachedProfile } = await loadStore()

    expect(cachedProfile()).toEqual({ email: null, name: null, picture: null, pro: false })
  })

  it('does not throw where localStorage is unavailable', async () => {
    // Safari private mode, and every server render.
    const { cachedProfile } = await loadStore()
    expect(cachedProfile()).toBeNull()
  })
})
