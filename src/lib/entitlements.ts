'use client'

import { useSyncExternalStore } from 'react'

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
 * Free on the server and during hydration, so the markup never differs. A Pro
 * user sees the sponsor card for one frame at most, which is the correct
 * trade against a hydration mismatch.
 */
export function useTier(): 'free' | 'pro' {
  return useSyncExternalStore(subscribe, currentTier, serverTier)
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
