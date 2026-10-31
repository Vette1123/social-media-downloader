'use client'

/**
 * Boots PostHog off the critical path and keeps its context current.
 *
 * Renders nothing. The SDK is fetched only by the timer in `afterPageSettles`,
 * never by a gesture or an error, so neither LCP nor INP pays for it; anything
 * captured before then is queued by lib/posthogClient and replayed in order.
 */

import type { CaptureResult } from 'posthog-js'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useAccount } from '@/lib/account'
import {
  identifyAccount,
  registerAnalyticsContext,
  trackCaughtError,
  trackPageview,
  trackProCtaClicked,
  trackPwaInstalled,
  trackSignedIn,
} from '@/lib/analytics'
import { shouldDropException } from '@/lib/analyticsNoise'
import { scrubEvent } from '@/lib/analyticsPrivacy'
import { getLocaleSnapshot, subscribeLocale } from '@/lib/i18nStore'
import { localeFromPath } from '@/lib/localeRoutes'
import {
  afterPageSettles,
  analyticsEnabled,
  loadPostHog,
  setPostHogInitializer,
} from '@/lib/posthogClient'

/** Share of sessions recorded: the free tier is 5K a month, and few get watched. */
const REPLAY_SAMPLE_RATE = 0.1
const REPLAY_KEY = 'smd_ph_replay'

/** One verdict per session: a replay with gaps cannot be trusted. */
function shouldRecordSession(): boolean {
  try {
    const stored = window.sessionStorage.getItem(REPLAY_KEY)
    if (stored) return stored === 'on'
    const record = Math.random() < REPLAY_SAMPLE_RATE
    window.sessionStorage.setItem(REPLAY_KEY, record ? 'on' : 'off')
    return record
  } catch {
    return false
  }
}

function deviceContext() {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string }
    deviceMemory?: number
  }
  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    online: nav.onLine,
    network_effective_type: nav.connection?.effectiveType,
    device_memory_gb: nav.deviceMemory,
    document_visibility: document.visibilityState,
  }
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event
  if (event.event === '$exception') {
    if (shouldDropException(event)) return null
    event.properties = { ...event.properties, ...deviceContext() }
  }
  return scrubEvent(event)
}

setPostHogInitializer((posthog) => {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    defaults: '2025-05-24',
    // No cookies: the privacy page says so, and nothing here needs a subdomain.
    persistence: 'localStorage',
    person_profiles: 'always',
    // Pageviews are sent by AnalyticsContext, because App Router navigation is
    // client-side and the landing view has to wait for this deferred init.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    capture_dead_clicks: true,
    rageclick: true,
    enable_heatmaps: true,
    capture_exceptions: true,
    // Console text and network URLs both quote the links people paste, so
    // neither is recorded. Results and Recent carry `ph-no-capture`, which keeps
    // them out of autocapture and blocks them in replay.
    capture_performance: { web_vitals: true, network_timing: false },
    enable_recording_console_log: false,
    session_recording: { maskAllInputs: true },
    disable_session_recording: !shouldRecordSession(),
    before_send: beforeSend,
  })
})

let booted = false
let stopEarlyCrashReports: (() => void) | null = null

/** The landing $pageview waits for this: it was skipped during the wait. */
async function boot(): Promise<void> {
  if (booted) return
  booted = true
  const posthog = await loadPostHog()
  stopEarlyCrashReports?.()
  if (posthog) trackPageview(window.location.pathname)
}

function scheduleBoot(): void {
  if (booted) return
  // A prerendered page may never be visited; a boot there bills a visit nobody
  // made. `prerenderingchange` fires on activation.
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    document.addEventListener('prerenderingchange', scheduleBoot, { once: true })
    return
  }
  afterPageSettles(() => void boot())
}

/**
 * A crash before the boot would otherwise be lost, since the SDK's own handler
 * is not attached yet. Queued through the same `ph` path, and removed once the
 * SDK is listening so nothing is reported twice. It does not boot early: a stray
 * extension error would otherwise pull the SDK into the page load.
 */
function reportEarlyCrashes(): void {
  const onError = (event: ErrorEvent) => {
    trackCaughtError('early_crash', event.error ?? event.message)
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    trackCaughtError('early_rejection', event.reason)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  stopEarlyCrashReports = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/**
 * Every route to /pro carries `data-pro-cta`. One listener, because half of them
 * sit in server components, which cannot hold a click handler.
 */
function onDocumentClick(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest?.('[data-pro-cta]')
  const surface = link?.getAttribute('data-pro-cta')
  if (surface) trackProCtaClicked({ surface })
}

if (typeof window !== 'undefined' && analyticsEnabled()) {
  reportEarlyCrashes()
  scheduleBoot()
  window.addEventListener('appinstalled', trackPwaInstalled)
  document.addEventListener('click', onDocumentClick, { capture: true })
}

const SIGNED_IN_KEY = 'smd_ph_signed_in'

function displayMode(): string {
  return window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
}

/** True the first time this browser is seen signed in since it last signed out. */
function latchSignedIn(): boolean {
  try {
    if (window.localStorage.getItem(SIGNED_IN_KEY)) return false
    window.localStorage.setItem(SIGNED_IN_KEY, '1')
    return true
  } catch {
    return false
  }
}

function clearSignedInLatch(): void {
  try {
    window.localStorage.removeItem(SIGNED_IN_KEY)
  } catch {
    // Blocked storage never set the latch either.
  }
}

/** Pageviews, super properties and identity. */
export function AnalyticsContext() {
  const pathname = usePathname()
  const { signedIn, userId, pro, plan } = useAccount()

  useEffect(() => {
    if (booted) trackPageview(pathname)
  }, [pathname])

  useEffect(() => {
    const sync = () =>
      registerAnalyticsContext({
        locale: localeFromPath(window.location.pathname) ?? getLocaleSnapshot(),
        display_mode: displayMode(),
        app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
        low_power: document.documentElement.classList.contains('low-power'),
      })
    sync()
    return subscribeLocale(sync)
  }, [])

  useEffect(() => {
    if (signedIn === undefined) return
    if (signedIn && userId) {
      identifyAccount(userId, { pro: pro === true, plan: plan?.status })
      if (latchSignedIn()) trackSignedIn()
      return
    }
    clearSignedInLatch()
    registerAnalyticsContext({ signed_in: false, pro: false })
  }, [signedIn, userId, pro, plan])

  return null
}
