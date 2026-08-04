/**
 * The Google half of sign-in: the OAuth 2.0 authorization-code flow with PKCE.
 *
 * This was `arctic`, behind a dynamic import so its module-scope work stayed
 * off the critical path. That defence turned out to be half of one: wrangler
 * emits a single-file bundle, so a dynamically imported module still gets
 * *compiled* at isolate startup even when it is never evaluated — and arctic
 * ships a client for every OAuth provider it supports, 123 KB of Coinbase,
 * Withings and Kick to reach the one we use. Compilation is billed to whichever
 * request created the isolate, which for this site is almost always an
 * anonymous /api/download with a 10 ms CPU budget.
 *
 * Removing it halves the Worker bundle (308 KiB -> 160 KiB) and takes a third
 * off the time an isolate spends compiling it (4.1 ms -> 2.4 ms, median of
 * repeated compiles). `pnpm cf:startup` reprints that number and CI fails if
 * the bundle creeps back. arctic is also deprecated upstream as of 3.7.0, so
 * the alternative was a rewrite onto its successor anyway.
 *
 * What replaces it is the flow itself: a URL, a form POST, and a base64url
 * decode. Nothing here is Google-specific beyond the two endpoints.
 */

import { base64UrlDecode, base64UrlEncode } from '../proToken'

// Re-exported so existing importers of these two names from `./google` keep
// working; see cookies.ts for why the constants themselves live there.
export { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from './cookies'

/**
 * How long the state and PKCE verifier survive.
 *
 * This bounds the round trip through Google, and ten minutes turned out to be
 * too tight for it: an account picker, a password, a 2FA prompt and a consent
 * screen on a phone is easily longer than that, and when the cookie expires
 * mid-flow the callback cannot tell the difference between that and a forged
 * request, so a legitimate sign-in fails.
 *
 * Half an hour costs little. Both values are single-use, HttpOnly, Secure and
 * SameSite=Lax, cleared on success and on failure alike, and the verifier is
 * useless without the authorization code — which Google expires on its own,
 * far sooner than this.
 */
const OAUTH_TEMP_TTL_SECONDS = 30 * 60

export function oauthTempCookie(name: string, value: string): string {
  const age = value === '' ? 0 : OAUTH_TEMP_TTL_SECONDS
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; SameSite=Lax; HttpOnly`
}

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * `profile` rides along with openid + email so the account control can show the
 * visitor's own Google avatar and name instead of a generic pill. Both are
 * cosmetic: nothing about entitlement or billing reads them, and a row without
 * them renders a monogram.
 */
const SCOPES = 'openid email profile'

/** Google answers the token endpoint in well under a second; ten is the bound
 *  past which the visitor is staring at a blank tab either way.
 *
 *  Overridable only so a slow developer network can be told apart from a broken
 *  exchange — production never sets it. arctic had no timeout at all, so a hung
 *  Google used to hold the request open until the platform killed it. */
const TOKEN_EXCHANGE_TIMEOUT_MS = Number(process.env.OAUTH_TIMEOUT_MS) || 10_000

/** The redirect URI, which must match the one registered with Google exactly
 *  and must be identical in the authorization and token requests. */
function callbackUrl(origin: string): string {
  return `${origin}/api/auth/callback`
}

/**
 * 256 bits of CSPRNG output, base64url.
 *
 * Serves as both the state token and the PKCE code verifier. As a verifier it
 * is 43 characters of the unreserved charset, which is the shortest length
 * RFC 7636 allows and exactly what the spec recommends generating.
 */
export function randomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

/** Where to send the browser to sign in. `state` and `verifier` come from
 *  `randomToken` and are stashed in one-shot cookies by the caller. */
export async function createAuthorizationUrl(
  origin: string,
  state: string,
  verifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))

  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', callbackUrl(origin))
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', base64UrlEncode(new Uint8Array(digest)))
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Redeem the authorization code for an ID token.
 *
 * Throws on every non-answer, which is what the caller wants: `invalid_grant`
 * — the ordinary response to a code some other delivery of the same callback
 * already redeemed — has to reach `handleAuthCallback`'s catch so it can ask
 * whether a session exists rather than report a failure.
 */
export async function exchangeAuthorizationCode(
  origin: string,
  code: string,
  verifier: string,
): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(origin),
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Google rejected the authorization code (${response.status})`)
  }

  const body = (await response.json()) as { id_token?: unknown }
  if (typeof body.id_token !== 'string' || !body.id_token) {
    throw new Error('Google returned no ID token')
  }
  return body.id_token
}

/**
 * The claims out of an ID token, decoded and not signature-verified.
 *
 * That is correct here and only here: this token arrived over TLS as the direct
 * response to a server-side request authenticated with our client secret, so
 * there is no untrusted path it could have travelled. A token from anywhere
 * else would have to be verified against Google's JWKS.
 *
 * `TextDecoder` rather than `atob` alone because a display name is UTF-8.
 */
export function decodeIdToken(idToken: string): unknown {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Malformed ID token')
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)))
}

/**
 * Where to send someone after signing in.
 *
 * An unvalidated redirect parameter on an auth endpoint is a textbook open
 * redirect, and phishing through the sign-in flow is more damaging than
 * anywhere else on the site: the victim has just been asked for credentials, so
 * a hostile landing page is maximally believable. Anything not provably on our
 * own origin becomes "/".
 *
 * Resolving against `origin` is what catches the awkward cases — a
 * protocol-relative `//evil.example` parses as another origin rather than a
 * path, and `javascript:` never matches.
 *
 * The origin check alone is not enough, though: `/..//evil.example` resolves to
 * a pathname of `//evil.example` ON our own origin, which passes that check and
 * then reads as protocol-relative again the moment it is used as a bare
 * `Location`. So the result is also forced to a single leading slash.
 */
export function safeRedirect(target: string | null, origin: string): string {
  if (!target) return '/'
  try {
    const url = new URL(target, origin)
    if (url.origin !== origin) return '/'
    return `/${url.pathname.replace(/^\/+/, '')}${url.search}`
  } catch {
    return '/'
  }
}
