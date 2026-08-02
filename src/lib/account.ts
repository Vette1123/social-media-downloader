'use client'

/**
 * Client-side account state.
 *
 * The access token is held in memory only and never persisted: it lives 15
 * minutes, and the durable credential is the httpOnly session cookie the
 * browser sends on its own. Nothing here is trusted — every entitlement
 * decision is made server-side and merely reported to this module.
 *
 * Modelled as an external store for the same reason as lib/prefs.ts: a
 * useSyncExternalStore snapshot avoids the render → effect → setState cascade
 * and the hydration mismatch that a mount effect would cause.
 */

import { useSyncExternalStore } from 'react'
import { HINT_COOKIE } from './auth/cookies'

/** Refresh this far before expiry, so a resolve never races the deadline. */
const REFRESH_MARGIN_MS = 30_000

export interface PlanState {
  status: string | null
  variant: string | null
  renewsAt: number | null
  endsAt: number | null
  pastDueSince: number | null
}

export interface AccountState {
  /** Undefined until the first refresh settles. */
  signedIn: boolean | undefined
  /**
   * The last refresh could not be answered — offline, or the deployment has no
   * `DB` binding / `PRO_TOKEN_SECRET` yet and answers 503. Without this the
   * account page waits on `signedIn` forever and shows a skeleton that never
   * resolves. It never clears account state: only an explicit 401 does that.
   */
  failed: boolean
  /** The account's internal id, needed to attach a checkout to its buyer. */
  userId: string | null
  pro: boolean
  email: string | null
  /** Google display name and avatar URL. Cosmetic, and null until the visitor
   *  has signed in once since the `profile` scope was added. */
  name: string | null
  picture: string | null
  plan: PlanState | null
}

/**
 * What the account control needs in order to paint, and nothing else.
 *
 * Mirrored into localStorage so the top-right avatar renders on the very first
 * frame of any page, with no request: the hint cookie already says *whether*
 * someone is signed in, and this says *who*, which is the other half of
 * rendering an avatar instead of a placeholder. A page view still costs zero
 * Worker invocations, which is the constraint the whole design is built around.
 *
 * It is a cache of the visitor's own public Google profile, not a credential.
 * Anything that could be forged into entitlement (`userId`, the access token)
 * stays out on purpose — this is display data, and the server is still the only
 * thing that decides what someone is entitled to.
 */
export interface CachedProfile {
  email: string | null
  name: string | null
  picture: string | null
  pro: boolean
}

const PROFILE_CACHE_KEY = 'smd_profile'

/** Synchronous, never throws: Safari private mode makes localStorage a trap. */
export function cachedProfile(): CachedProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      picture: typeof parsed.picture === 'string' ? parsed.picture : null,
      pro: parsed.pro === true,
    }
  } catch {
    return null
  }
}

function writeProfileCache(profile: CachedProfile | null): void {
  try {
    if (!profile) window.localStorage.removeItem(PROFILE_CACHE_KEY)
    else window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Quota, private mode, or a blocked origin. The avatar just waits for the
    // next refresh instead of painting immediately; nothing else depends on it.
  }
}

interface Token {
  token: string
  expiresAt: number
}

export function tokenIsUsable(token: Token | null, now: number): boolean {
  if (!token) return false
  return token.expiresAt - now > REFRESH_MARGIN_MS
}

export function signInHref(redirectTo?: string): string {
  if (!redirectTo) return '/api/auth/google'
  return `/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`
}

/**
 * Whether the browser is probably signed in, answered synchronously with no
 * network call. The header renders from this so that a page view still invokes
 * no Worker at all — see src/lib/auth/cookies.ts.
 */
export function hasAccountHint(): boolean {
  try {
    return document.cookie.split(';').some((part) => part.trim().startsWith(`${HINT_COOKIE}=1`))
  } catch {
    return false
  }
}

const SIGNED_OUT: AccountState = Object.freeze({
  signedIn: false,
  failed: false,
  userId: null,
  pro: false,
  email: null,
  name: null,
  picture: null,
  plan: null,
})

const UNKNOWN: AccountState = Object.freeze({
  signedIn: undefined,
  failed: false,
  userId: null,
  pro: false,
  email: null,
  name: null,
  picture: null,
  plan: null,
})

let state: AccountState = UNKNOWN
let token: Token | null = null
let inFlight: Promise<void> | null = null

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The store's reader. Exported so the transitions can be tested without a renderer. */
export function accountSnapshot(): AccountState {
  return state
}

const getSnapshot = accountSnapshot
const getServerSnapshot = (): AccountState => UNKNOWN

/**
 * A refresh that could not be answered. Everything already known is kept —
 * a paying customer must never be downgraded because one request failed — and
 * only the flag the UI needs in order to say so is added.
 */
/**
 * The one path to signed-out state, so the profile cache can never outlive the
 * session it describes. Every caller that used to assign SIGNED_OUT by hand
 * left a stale avatar in localStorage for the next visitor to this browser.
 */
function settleSignedOut(): void {
  token = null
  writeProfileCache(null)
  if (state === SIGNED_OUT) return
  state = SIGNED_OUT
  notify()
}

function markFailed(): void {
  if (state.failed) return
  state = { ...state, failed: true }
  notify()
}

/**
 * Lazy, never on a timer.
 *
 * A 15-minute heartbeat would be 96 requests per user per day; at a thousand
 * subscribers that alone would exhaust the 100k/day request budget the
 * downloader needs. Refreshing on demand ties cost to activity instead.
 */
export async function refreshAccount(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && tokenIsUsable(token, Date.now())) return
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(`/api/auth/refresh${opts.force ? '?reconcile=1' : ''}`, {
        method: 'POST',
      })
      if (response.status === 401) {
        settleSignedOut()
        return
      }
      // Anything else — notably the 503 a deployment without `DB` or
      // `PRO_TOKEN_SECRET` returns — is unanswerable, not signed out.
      if (!response.ok) {
        markFailed()
        return
      }

      const data = await response.json()
      if (!data?.success) {
        markFailed()
        return
      }

      token = { token: data.token, expiresAt: data.expiresAt }
      state = {
        signedIn: true,
        failed: false,
        userId: data.userId ?? null,
        pro: data.pro === true,
        email: data.email ?? null,
        name: data.name ?? null,
        picture: data.picture ?? null,
        plan: data.plan ?? null,
      }
      writeProfileCache({
        email: state.email,
        name: state.name,
        picture: state.picture,
        pro: state.pro,
      })
      notify()

      const { adoptServerPrefs } = await import('./prefs')
      adoptServerPrefs(data.prefs)
    } catch {
      // Network failure. Deliberately leaves the existing token in place: a
      // paying customer must never be downgraded because one request failed.
      // A genuinely dead session keeps failing until the token expires on its
      // own, which bounds the worst case to one TTL.
      markFailed()
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export async function signOut(all = false): Promise<void> {
  try {
    await fetch(`/api/auth/logout${all ? '?all=1' : ''}`, { method: 'POST' })
  } catch {
    // The cookies are cleared server-side; a failure here just means retrying.
  }
  settleSignedOut()
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The in-memory access token, or null. Consumed by useProToken. */
export function currentAccessToken(): string | null {
  if (!token) return null
  if (token.expiresAt <= Date.now()) return null
  return token.token
}

/** Called before a resolve, so the token in hand is fresh enough to use. */
export function ensureFreshToken(): void {
  if (!hasAccountHint()) return
  void refreshAccount()
}

/**
 * Settle the store as signed out without spending a request.
 *
 * The hint cookie is the client's own answer to "is there a session?", so a
 * visitor without one needs no round trip to learn they are signed out. That
 * keeps a page view at zero Worker requests, which is the entire reason the
 * hint exists — and it means a fetch that never completes (an extension
 * blocking it, a dropped connection) can no longer strand a signed-out
 * visitor on an error screen instead of the sign-in prompt.
 */
export function markSignedOut(): void {
  settleSignedOut()
}
