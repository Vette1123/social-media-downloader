'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { TOKEN_TTL_MS } from './licenseToken'

export const LICENSE_KEY_STORAGE = 'smd:license'

export interface StoredLicense {
  key: string
  instanceId: string
  token: string
  expiresAt: number
}

/**
 * Pro state lives entirely in localStorage. There is no account, so the key is
 * the credential and the browser is the only place it is kept.
 *
 * The ad-free half of Pro is enforced client-side and is trivially bypassable.
 * That is accepted: the honest buyer is the customer, and the entitlement that
 * actually costs us something (priority resolve) is checked server-side against
 * a signed token.
 */
export function readLicense(): StoredLicense | null {
  try {
    const raw = window.localStorage.getItem(LICENSE_KEY_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLicense
    if (typeof parsed?.token !== 'string' || typeof parsed?.expiresAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveLicense(license: StoredLicense): void {
  try {
    window.localStorage.setItem(LICENSE_KEY_STORAGE, JSON.stringify(license))
    notify()
  } catch {
    // Storage blocked — the purchase still works, it just will not persist.
  }
}

export function clearLicense(): void {
  try {
    window.localStorage.removeItem(LICENSE_KEY_STORAGE)
    notify()
  } catch {
    // Nothing to do.
  }
}

/**
 * Exchange a key for a token. Called on first entry and again whenever the
 * stored token has aged out, which is at most once a day.
 */
export async function activateLicense(
  licenseKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = readLicense()
  try {
    const response = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        instanceId: existing?.key === licenseKey ? existing.instanceId : undefined,
      }),
    })
    const data = await response.json()
    if (!data?.success) {
      return { ok: false, error: data?.error || 'That key was not accepted.' }
    }
    saveLicense({
      key: licenseKey,
      instanceId: data.instanceId,
      token: data.token,
      expiresAt: data.expiresAt,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the license server. Try again.' }
  }
}

// A tiny store so every mounted component reacts to an activation without a
// reload. Mirrors the useSyncExternalStore pattern already used in clientEnv.ts.
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function currentTier(): 'free' | 'pro' {
  const license = readLicense()
  if (!license) return 'free'
  if (license.expiresAt <= Date.now()) return 'free'
  return 'pro'
}

const serverTier = (): 'free' | 'pro' => 'free'

/**
 * Revalidate once the stored token is within a quarter of its lifetime of
 * expiring (6 hours, since TOKEN_TTL_MS is 24h) — early enough that even an
 * occasional visitor gets silently refreshed before the token actually lapses,
 * without re-hitting the license server on every mount of a token that just
 * got minted. An already-expired token also counts (the difference is
 * negative), so the very next visit after a lapse retries immediately instead
 * of waiting for the user to notice and re-enter their key.
 *
 * Pure and exported so this boundary can be unit-tested without a DOM —
 * {@link maybeRevalidate} is the only caller and is otherwise untestable
 * (localStorage + fetch) under this repo's node-only Vitest config.
 */
export function needsRevalidation(expiresAt: number, now: number): boolean {
  return expiresAt - now <= TOKEN_TTL_MS / 4
}

// Guards against every mounted useTier() consumer (PromoSlot at two
// placements today, potentially more later) kicking off a duplicate request
// the instant they all mount together.
let revalidationInFlight = false

/**
 * Silent background refresh. The design calls for the client to revalidate
 * daily; nothing else in this codebase schedules that, so without this a
 * license quietly demotes to free at `expiresAt` and stays there until the
 * customer re-enters their key — worse than the free tier they paid to leave.
 *
 * Deliberately not awaited by its caller: this is fire-and-forget so a mount
 * is never blocked on a network round trip, and there is no UI for it to
 * report through — success is invisible (the refreshed token lands via
 * `saveLicense`'s `notify()`, same path as first activation) and failure is
 * equally invisible. `activateLicense` never touches storage on a rejection,
 * timeout, or network error, so a flaky revalidation cannot downgrade an
 * in-session Pro user; a key that is genuinely dead simply keeps failing
 * until `expiresAt` passes on its own, which bounds the worst case to about
 * one TOKEN_TTL_MS — the same fail-safe behaviour as before this existed, not
 * a new retry loop.
 */
function maybeRevalidate(): void {
  if (revalidationInFlight) return
  const license = readLicense()
  if (!license) return
  if (!needsRevalidation(license.expiresAt, Date.now())) return

  revalidationInFlight = true
  void activateLicense(license.key).finally(() => {
    revalidationInFlight = false
  })
}

/**
 * Free on the server and during hydration, so the markup never differs.
 * Consumers that render something whose presence must never flash (the
 * sponsor card) additionally gate on `useHydrated()` themselves — see
 * PromoSlot — because this hook alone only guarantees no hydration mismatch,
 * not that the client value is known on the very first client render.
 */
export function useTier(): 'free' | 'pro' {
  const tier = useSyncExternalStore(subscribe, currentTier, serverTier)
  useEffect(() => {
    maybeRevalidate()
  }, [])
  return tier
}

function currentToken(): string | null {
  const license = readLicense()
  if (!license || license.expiresAt <= Date.now()) return null
  return license.token
}

const serverToken = (): string | null => null

export function useProToken(): string | null {
  return useSyncExternalStore(subscribe, currentToken, serverToken)
}
