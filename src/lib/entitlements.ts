'use client'

/**
 * Pro state, as the app sees it.
 *
 * The whole implementation moved from a license key in localStorage to a Google
 * account with a server session — but the two hooks below kept their exact
 * shapes, which is why DownloaderApp and PromoSlot did not change at all.
 *
 * As before, the ad-free half of Pro is enforced client-side and is trivially
 * bypassable. That is accepted: the honest subscriber is the customer, and the
 * entitlement that actually costs us something (priority resolve) is checked
 * server-side against a signed token.
 */

import { useEffect } from 'react'
import { currentAccessToken, ensureFreshToken, useAccount } from './account'

/**
 * Free on the server and during hydration, so the markup never differs.
 * Consumers that render something whose presence must never flash (the sponsor
 * card) additionally gate on `useHydrated()` themselves — see PromoSlot —
 * because this hook alone only guarantees no hydration mismatch, not that the
 * client value is known on the very first client render.
 */
export function useTier(): 'free' | 'pro' {
  const account = useAccount()
  useEffect(() => {
    ensureFreshToken()
  }, [])
  return account.pro ? 'pro' : 'free'
}

export function useProToken(): string | null {
  // Subscribing to the account store is what re-renders this when a refresh
  // lands; the token itself is read imperatively because it is not part of the
  // snapshot (a fresh string each call would re-render forever).
  useAccount()
  return currentAccessToken()
}
