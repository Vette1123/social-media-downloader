/**
 * The auth surface: five handlers, all shaped like every other route in
 * API_ROUTES so the Worker can dispatch them without initialising Next.
 *
 * `arctic` and the reconcile path are dynamically imported inside the handlers
 * that need them. An isolate that only ever serves downloads must never load
 * either — see src/lib/auth/google.ts for why.
 */

import { requireDb, type WorkerEnv } from '../apiRoutes'
import type { WaitUntilContext } from '../edgeCache'
import { ACCESS_TOKEN_TTL_MS, signToken } from '../proToken'
import { isProAt } from '../billing/entitlement'
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  googleClient,
  oauthTempCookie,
  safeRedirect,
} from './google'
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearCookieHeaders,
  createSession,
  deleteAllSessions,
  deleteSession,
  loadSession,
  readCookie,
  sessionCookieHeaders,
} from './session'

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/**
 * The state cookie packs two fields into one value, so the separator has to be
 * a character `encodeURIComponent` escapes and an OAuth state (base64url) can
 * never contain. `.` was neither, which silently truncated `/pro.html` to
 * `/pro`; `%7C` is what an encoded target turns a `|` into.
 */
const STATE_SEPARATOR = '|'

export function packAuthState(state: string, target: string): string {
  return `${state}${STATE_SEPARATOR}${encodeURIComponent(target)}`
}

/**
 * The inverse. Never throws: a malformed percent-sequence in a cookie must fail
 * to the safe default, not 500 the callback. The returned target is still
 * untrusted — `safeRedirect` is what makes it safe to follow.
 */
export function unpackAuthState(cookie: string | null): { state: string; target: string } {
  const [state = '', encodedTarget = ''] = (cookie ?? '').split(STATE_SEPARATOR)
  try {
    return { state, target: decodeURIComponent(encodedTarget) || '/' }
  } catch {
    return { state, target: '/' }
  }
}

/**
 * Google sends `email_verified` as a boolean, and older tokens as a string.
 * Only an explicit negative rejects: an absent claim is not evidence of
 * anything, and `users.email` is what billing matches on.
 */
function emailUnverified(value: unknown): boolean {
  return value === false || value === 'false'
}

interface IdTokenClaims {
  sub?: string
  email?: string
  email_verified?: unknown
}

/** GET /api/auth/google */
export async function handleAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return Response.json(
      { success: false, error: 'Sign-in is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const arctic = await import('arctic')
  const state = arctic.generateState()
  const verifier = arctic.generateCodeVerifier()
  const google = await googleClient(url.origin)

  // openid + email only. We need an identifier and an address to match an
  // orphaned webhook against; a profile scope would collect a name and photo
  // this design has nowhere to put.
  const authorizationUrl = google.createAuthorizationURL(state, verifier, ['openid', 'email'])

  // The post-login destination rides in the state cookie's sibling rather than
  // through Google, so it cannot be tampered with in transit.
  const target = safeRedirect(url.searchParams.get('redirect_to'), url.origin)

  return redirect(authorizationUrl.toString(), [
    oauthTempCookie(OAUTH_STATE_COOKIE, packAuthState(state, target)),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, verifier),
  ])
}

/** GET /api/auth/callback */
export async function handleAuthCallback(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const url = new URL(request.url)
  const cookies = request.headers.get('Cookie')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = readCookie(cookies, OAUTH_STATE_COOKIE)
  const verifier = readCookie(cookies, OAUTH_VERIFIER_COOKIE)

  const { state: expectedState, target: requestedTarget } = unpackAuthState(storedState)
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return Response.json(
      { success: false, error: 'Sign-in could not be completed. Please try again.' },
      { status: 400 },
    )
  }

  const google = await googleClient(url.origin)
  const arctic = await import('arctic')

  let claims: IdTokenClaims
  try {
    const tokens = await google.validateAuthorizationCode(code, verifier)
    // Decoded, not signature-verified, and that is correct here: the token
    // arrived over TLS as the direct response to a server-side request
    // authenticated with our client secret. There is no untrusted path it could
    // have travelled.
    claims = arctic.decodeIdToken(tokens.idToken()) as IdTokenClaims
  } catch {
    return Response.json(
      { success: false, error: 'Sign-in could not be completed. Please try again.' },
      { status: 400 },
    )
  }

  if (!claims.sub || !claims.email) {
    return Response.json(
      { success: false, error: 'Google did not return an email address.' },
      { status: 400 },
    )
  }

  // An unverified address must never reach `users.email`: that column is what
  // an orphaned purchase is matched against, so accepting one would let anyone
  // claim someone else's billing row by signing up with their address.
  if (emailUnverified(claims.email_verified)) {
    return Response.json(
      { success: false, error: 'Google did not return a verified email address.' },
      { status: 400 },
    )
  }

  const now = Date.now()
  // ON CONFLICT keeps the email current for someone who changed it at Google,
  // without disturbing their billing columns.
  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email`,
    )
    .bind(crypto.randomUUID(), claims.sub, claims.email, now)
    .run()

  const user = await db
    .prepare('SELECT id FROM users WHERE google_sub = ?')
    .bind(claims.sub)
    .first<{ id: string }>()

  if (!user) {
    return Response.json(
      { success: false, error: 'Could not create your account. Please try again.' },
      { status: 500 },
    )
  }

  const raw = await createSession(db, user.id, now)
  const target = safeRedirect(requestedTarget, url.origin)

  return redirect(`${url.origin}${target}`, [
    ...sessionCookieHeaders(raw, Math.floor(SESSION_TTL_MS / 1000)),
    oauthTempCookie(OAUTH_STATE_COOKIE, ''),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, ''),
  ])
}

/** POST /api/auth/refresh */
export async function handleRefresh(
  request: Request,
  ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const secret = process.env.PRO_TOKEN_SECRET?.trim()
  if (!secret) {
    return Response.json(
      { success: false, error: 'Sign-in is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const now = Date.now()
  const raw = readCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  const user = await loadSession(db, raw, now)

  if (!user) {
    // Clear the hint too, so a client holding a stale hint stops rendering an
    // avatar for a session that no longer exists.
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: false, error: 'Not signed in' }), {
      status: 401,
      headers,
    })
  }

  // Repair a row webhooks lost. Deferred past the response, so the user waits
  // for nothing, and skipped entirely when the row is fresh — which, when
  // webhooks are working, is always.
  const forced = new URL(request.url).searchParams.get('reconcile') === '1'
  const { needsReconcile, reconcileSubscription } = await import('../billing/reconcile')
  if (needsReconcile(user, now, forced)) {
    // The user row goes with it: a forced reconcile for someone whose webhook
    // was lost has no `ls_subscription_id` to look up, and finds the
    // subscription by the address they signed in with instead.
    const work = reconcileSubscription(db, user.ls_subscription_id, now, user)
    if (ctx) ctx.waitUntil(work)
    else await work
  }

  const pro = isProAt(user, now)
  const exp = now + ACCESS_TOKEN_TTL_MS
  const token = await signToken({ u: user.id, exp, p: pro }, secret)

  return Response.json({
    success: true,
    token,
    expiresAt: exp,
    // The checkout link has to carry this as `custom_data.user_id`, or the
    // webhook can only match the purchase by email — which is editable at
    // checkout, and is the PayPal account's address when paying that way. An
    // internal UUID handed to its own signed-in owner discloses nothing.
    userId: user.id,
    pro,
    email: user.email,
    plan: {
      status: user.ls_status,
      variant: user.ls_variant,
      renewsAt: user.ls_renews_at,
      endsAt: user.ls_ends_at,
      pastDueSince: user.ls_past_due_since,
    },
    prefs: user.prefs,
  })
}

/** POST /api/auth/logout */
export async function handleLogout(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const raw = readCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  const all = new URL(request.url).searchParams.get('all') === '1'

  if (all) {
    const user = await loadSession(db, raw, Date.now())
    if (user) await deleteAllSessions(db, user.id)
  } else {
    await deleteSession(db, raw)
  }

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}

/** POST /api/account — { prefs } to save, { delete: true } to close the account. */
export async function handleAccount(
  request: Request,
  _ctx?: WaitUntilContext,
  env?: WorkerEnv,
): Promise<Response> {
  const db = requireDb(env)
  if (db instanceof Response) return db

  const now = Date.now()
  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    now,
  )
  if (!user) {
    return Response.json({ success: false, error: 'Not signed in' }, { status: 401 })
  }

  let body: { prefs?: unknown; delete?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.delete === true) {
    // Refuse while the subscription is still entitling. Deleting the row does
    // not cancel anything at Lemon Squeezy: it would keep billing, every later
    // webhook would match zero rows, a fresh sign-in would create a row with a
    // NULL subscription that reconcile cannot repair, and the billing portal
    // would 404 — paying forever with no Pro and no way back.
    if (isProAt(user, now)) {
      return Response.json(
        {
          success: false,
          error:
            'Cancel your subscription in the billing portal first. Deleting the account now would leave it billing you with no way to restore Pro.',
        },
        { status: 409 },
      )
    }

    // Sessions cascade.
    await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: true }), { status: 200, headers })
  }

  // ../prefsCore, never ../prefs: the latter is a `'use client'` module and
  // pulls React's whole module scope into this isolate to run a validator.
  const { normalisePrefs } = await import('../prefsCore')
  const prefs = normalisePrefs(body.prefs)
  if (!prefs) {
    return Response.json({ success: false, error: 'Invalid preferences' }, { status: 400 })
  }

  await db
    .prepare('UPDATE users SET prefs = ? WHERE id = ?')
    .bind(JSON.stringify(prefs), user.id)
    .run()

  return Response.json({ success: true, prefs })
}
