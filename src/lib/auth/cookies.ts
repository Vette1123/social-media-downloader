/**
 * Auth cookie names, and nothing else.
 *
 * These live apart from session.ts and google.ts because those modules pull in
 * D1 queries and `sha256Hex` (crypto) — fine for server code, but a client
 * module (account.ts) only needs the *name* of the hint cookie to read
 * `document.cookie`. Importing it from session.ts would risk the bundler
 * pulling database and crypto code into the browser bundle on every page, on a
 * project where performance is the priority and pages are otherwise static.
 * This module imports nothing, so nothing it doesn't already need can ride
 * along with it.
 */

export const SESSION_COOKIE = 'smd_session'

/**
 * A second, deliberately script-readable cookie carrying no user data.
 *
 * The header control needs to know whether to render "Sign in" or an avatar,
 * and it renders on every page. Asking an endpoint would put every page view
 * back on the Worker and spend the 100k/day request budget drawing an avatar,
 * so the answer is a cookie the client can read with no network call.
 *
 * It is a hint, never a credential: every real decision still requires the
 * httpOnly session cookie, checked server-side. Forging it buys an avatar that
 * links to a page telling you to sign in.
 */
export const HINT_COOKIE = 'smd_account'

/** Short-lived, single-use, and gone by the time the callback returns. */
export const OAUTH_STATE_COOKIE = 'smd_oauth_state'
export const OAUTH_VERIFIER_COOKIE = 'smd_oauth_verifier'
