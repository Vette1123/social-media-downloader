import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAuthorizationUrl,
  decodeIdToken,
  exchangeAuthorizationCode,
  randomToken,
  safeRedirect,
} from './google'

const ORIGIN = 'https://example.com'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** base64url, no padding — what a PKCE verifier and a JWT segment both are. */
const BASE64URL = /^[A-Za-z0-9_-]+$/

describe('randomToken', () => {
  it('is a legal PKCE code verifier', () => {
    const token = randomToken()
    // RFC 7636 §4.1: 43-128 characters of the unreserved set. 32 random bytes
    // base64url-encoded is exactly 43.
    expect(token).toMatch(BASE64URL)
    expect(token.length).toBe(43)
  })

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 100 }, randomToken))
    expect(tokens.size).toBe(100)
  })
})

describe('createAuthorizationUrl', () => {
  it('derives the PKCE challenge exactly as RFC 7636 does', async () => {
    // The known-answer pair from RFC 7636 Appendix B. If the S256 derivation
    // ever drifts, Google rejects every sign-in at the token exchange with a
    // message that says nothing about why — so it is pinned here instead.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const url = new URL(await createAuthorizationUrl(ORIGIN, 'state-value', verifier))

    expect(url.searchParams.get('code_challenge')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('asks Google for a code with the scopes the account page renders', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-123')
    const url = new URL(await createAuthorizationUrl(ORIGIN, 'state-value', randomToken()))

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('client-id-123')
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`)
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('state')).toBe('state-value')
  })

  it('never leaks the verifier itself into the URL', async () => {
    const verifier = randomToken()
    const url = await createAuthorizationUrl(ORIGIN, 'state-value', verifier)
    expect(url).not.toContain(verifier)
  })
})

/** A JWT with `payload` as its claims. Only the middle segment is ever read. */
function idToken(payload: unknown): string {
  const body = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

describe('decodeIdToken', () => {
  it('reads the claims', () => {
    const claims = decodeIdToken(idToken({ sub: '123', email: 'a@b.test', email_verified: true }))
    expect(claims).toEqual({ sub: '123', email: 'a@b.test', email_verified: true })
  })

  it('decodes a non-ASCII display name as UTF-8', () => {
    // `atob` alone would mangle this into mojibake and put it in the database.
    const claims = decodeIdToken(idToken({ name: 'Mohamed Gadó — محمد' }))
    expect(claims).toEqual({ name: 'Mohamed Gadó — محمد' })
  })

  it('throws on a token with no payload segment', () => {
    expect(() => decodeIdToken('not-a-jwt')).toThrow()
  })
})

describe('exchangeAuthorizationCode', () => {
  function stubTokenEndpoint(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('posts the code and the verifier, and returns the ID token', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id-123')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret-456')
    const fetchMock = stubTokenEndpoint(Response.json({ id_token: 'the.id.token' }))

    const token = await exchangeAuthorizationCode(ORIGIN, 'auth-code', 'the-verifier')
    expect(token).toBe('the.id.token')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')

    const body = new URLSearchParams(init.body.toString())
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
    expect(body.get('client_secret')).toBe('client-secret-456')
    // Must match the authorization request's redirect_uri exactly, or Google
    // answers redirect_uri_mismatch.
    expect(body.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`)
  })

  it('throws on invalid_grant, so a duplicate callback reaches the quiet path', async () => {
    // The response to a code another delivery of the same callback already
    // redeemed. handleAuthCallback catches this and checks for a live session
    // rather than reporting a failure — see the duplicate-callback fix.
    stubTokenEndpoint(Response.json({ error: 'invalid_grant' }, { status: 400 }))
    await expect(exchangeAuthorizationCode(ORIGIN, 'used-code', 'v')).rejects.toThrow()
  })

  it('throws on a 200 that carries no ID token', async () => {
    stubTokenEndpoint(Response.json({ access_token: 'only-this' }))
    await expect(exchangeAuthorizationCode(ORIGIN, 'code', 'v')).rejects.toThrow()
  })
})

describe('safeRedirect', () => {
  it('defaults to the home page when nothing was requested', () => {
    expect(safeRedirect(null, ORIGIN)).toBe('/')
  })

  it('keeps a same-origin path', () => {
    expect(safeRedirect('/tiktok-downloader', ORIGIN)).toBe('/tiktok-downloader')
  })

  it('keeps a query string', () => {
    expect(safeRedirect('/account?checkout=success', ORIGIN)).toBe('/account?checkout=success')
  })

  it('accepts an absolute URL on our own origin, reduced to a path', () => {
    expect(safeRedirect(`${ORIGIN}/pro`, ORIGIN)).toBe('/pro')
  })

  it('rejects another origin', () => {
    expect(safeRedirect('https://evil.example/phish', ORIGIN)).toBe('/')
  })

  it('rejects a protocol-relative URL, which resolves off-origin', () => {
    expect(safeRedirect('//evil.example/phish', ORIGIN)).toBe('/')
  })

  it('collapses a path that climbs back into protocol-relative form', () => {
    // `/..//evil.example` resolves to a pathname of `//evil.example` on OUR
    // origin, so the origin check passes and the bare result would read as
    // protocol-relative all over again.
    expect(safeRedirect('/..//evil.example', ORIGIN)).toBe('/evil.example')
    expect(safeRedirect('/a/../..//evil.example', ORIGIN)).toBe('/evil.example')
  })

  it('rejects a javascript: URL', () => {
    expect(safeRedirect('javascript:alert(1)', ORIGIN)).toBe('/')
  })

  it('rejects a malformed target rather than throwing', () => {
    expect(safeRedirect('http://[', ORIGIN)).toBe('/')
  })

  it('drops any fragment', () => {
    expect(safeRedirect('/pro#pricing', ORIGIN)).toBe('/pro')
  })
})
