/**
 * The Google half of sign-in.
 *
 * `arctic` is loaded with a dynamic import inside `googleClient`, never at
 * module scope. Module-scope initialisation is billed to the first request that
 * loads the module in every isolate — the same mechanism that made Next's lazy
 * init cost 129 ms here — and `apiRoutes.ts` imports one shared route table, so
 * a top-level import would put the OAuth client on the critical path of an
 * anonymous /api/download.
 */

import type { Google } from 'arctic'

// Re-exported so existing importers of these two names from `./google` keep
// working; see cookies.ts for why the constants themselves live there.
export { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from './cookies'

const OAUTH_TEMP_TTL_SECONDS = 10 * 60

export function oauthTempCookie(name: string, value: string): string {
  const age = value === '' ? 0 : OAUTH_TEMP_TTL_SECONDS
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; SameSite=Lax; HttpOnly`
}

export async function googleClient(origin: string): Promise<Google> {
  const { Google } = await import('arctic')
  return new Google(
    process.env.GOOGLE_CLIENT_ID ?? '',
    process.env.GOOGLE_CLIENT_SECRET ?? '',
    `${origin}/api/auth/callback`,
  )
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
 */
export function safeRedirect(target: string | null, origin: string): string {
  if (!target) return '/'
  try {
    const url = new URL(target, origin)
    if (url.origin !== origin) return '/'
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}
