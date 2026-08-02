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
    oauthTempCookie(OAUTH_STATE_COOKIE, `${state}.${encodeURIComponent(target)}`),
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

  const [expectedState, encodedTarget = '%2F'] = (storedState ?? '').split('.')
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return Response.json(
      { success: false, error: 'Sign-in could not be completed. Please try again.' },
      { status: 400 },
    )
  }

  const google = await googleClient(url.origin)
  const arctic = await import('arctic')

  let claims: { sub?: string; email?: string }
  try {
    const tokens = await google.validateAuthorizationCode(code, verifier)
    // Decoded, not signature-verified, and that is correct here: the token
    // arrived over TLS as the direct response to a server-side request
    // authenticated with our client secret. There is no untrusted path it could
    // have travelled.
    claims = arctic.decodeIdToken(tokens.idToken()) as { sub?: string; email?: string }
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
  const target = safeRedirect(decodeURIComponent(encodedTarget), url.origin)

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
    const work = reconcileSubscription(db, user.ls_subscription_id as string, now)
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

  const user = await loadSession(
    db,
    readCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    Date.now(),
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
    // Sessions cascade. This does not cancel a live subscription — the UI warns
    // and links to the billing portal before offering this.
    await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of clearCookieHeaders()) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: true }), { status: 200, headers })
  }

  const { normalisePrefs } = await import('../prefs')
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
