'use client'

import { useEffect } from 'react'
import { trackPageNotFound } from '@/lib/analytics'

/** not-found.tsx is a server component, so its one event needs this client leaf. */
export function NotFoundTracker() {
  useEffect(() => trackPageNotFound(), [])
  return null
}
