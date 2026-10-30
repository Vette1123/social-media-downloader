/**
 * The typed PostHog event layer.
 *
 * `track` is the only capture call site, so a misspelt event is a compile error
 * and every event gets `area`, `route` and the visit counter. Reaches posthog-js
 * through the lazy `ph()` (see posthogClient), never directly.
 *
 * Sibling modules are imported by relative path so this file loads under
 * Vitest, like the rest of lib/, and it imports nothing app-specific so it can
 * stay a leaf that anything may call.
 */

import {
  claim,
  isClaimed,
  milestonesFor,
  noteActivity,
  routeTemplate,
  visitTraits,
} from './analyticsContext'
import {
  errorMessage,
  failureCode,
  isExpectedFailure,
} from './analyticsErrors'
import { contentLink, scrubText } from './analyticsPrivacy'
import { ph } from './posthogClient'

export const EVENTS = {
  // The core funnel: link → resolve → file.
  LINK_SUBMITTED: 'link_submitted',
  LINK_REJECTED: 'link_rejected',
  RESOLVE_SUCCEEDED: 'resolve_succeeded',
  RESOLVE_FAILED: 'resolve_failed',
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_COMPLETED: 'download_completed',
  DOWNLOAD_FAILED: 'download_failed',
  DOWNLOAD_CANCELED: 'download_canceled',
  // Batches
  BATCH_STARTED: 'batch_started',
  BATCH_FINISHED: 'batch_finished',
  BATCH_CANCELED: 'batch_canceled',
  PLAYLIST_IMPORTED: 'playlist_imported',
  // Accounts and Pro
  SIGNED_IN: 'signed_in',
  SIGNED_OUT: 'signed_out',
  ACCOUNT_DELETED: 'account_deleted',
  PLAN_CANCELED: 'plan_canceled',
  PRO_CTA_CLICKED: 'pro_cta_clicked',
  PRO_NUDGE_SHOWN: 'pro_nudge_shown',
  // PWA
  PWA_INSTALLABLE: 'pwa_installable',
  PWA_PROMPTED: 'pwa_prompted',
  PWA_INSTALLED: 'pwa_installed',
  // Consolidated kinds: a new control is a new literal, not a new dashboard.
  PREF_CHANGED: 'pref_changed',
  SHARED: 'shared',
  RETRY_CLICKED: 'retry_clicked',
  FEATURE_USED: 'feature_used',
  // Health
  PAGE_NOT_FOUND: 'page_not_found',
  API_ERROR: 'api_error',
  // Once-ever milestones, derived inside track() and never fired by a call site.
  FIRST_DOWNLOAD: 'first_download',
  FIRST_CORE_USE: 'first_core_use',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

export type EventArea =
  | 'resolve'
  | 'download'
  | 'batch'
  | 'history'
  | 'account'
  | 'pro'
  | 'pwa'
  | 'sharing'
  | 'settings'
  | 'health'
  | 'activation'

// `satisfies` makes a new event without an area a compile error.
export const EVENT_AREA = {
  link_submitted: 'resolve',
  link_rejected: 'resolve',
  resolve_succeeded: 'resolve',
  resolve_failed: 'resolve',
  download_started: 'download',
  download_completed: 'download',
  download_failed: 'download',
  download_canceled: 'download',
  batch_started: 'batch',
  batch_finished: 'batch',
  batch_canceled: 'batch',
  playlist_imported: 'batch',
  signed_in: 'account',
  signed_out: 'account',
  account_deleted: 'account',
  plan_canceled: 'pro',
  pro_cta_clicked: 'pro',
  pro_nudge_shown: 'pro',
  pwa_installable: 'pwa',
  pwa_prompted: 'pwa',
  pwa_installed: 'pwa',
  pref_changed: 'settings',
  shared: 'sharing',
  retry_clicked: 'health',
  // Overridden per feature by FEATURE_AREA.
  feature_used: 'download',
  page_not_found: 'health',
  api_error: 'health',
  first_download: 'activation',
  first_core_use: 'activation',
} as const satisfies Record<EventName, EventArea>

/** The long tail of controls: one event, a feature, and the area it belongs to. */
export const FEATURE_AREA = {
  paste_chip: 'resolve',
  paste_anywhere: 'resolve',
  clipboard_watch: 'resolve',
  quality_repick: 'resolve',
  preview: 'download',
  gallery: 'download',
  gallery_select_all: 'download',
  lightbox: 'download',
  save_both: 'download',
  send_to_app: 'sharing',
  batch_lanes: 'batch',
  batch_save_all: 'batch',
  history_reopen: 'history',
  history_remove: 'history',
  history_show_all: 'history',
  history_export: 'history',
  history_import: 'history',
  history_clear: 'history',
  account_menu: 'account',
  sign_in_link: 'account',
  pin_account: 'account',
  nudge_dismiss: 'pro',
  apps_menu: 'pro',
  app_store: 'pro',
  promo_click: 'pro',
} as const satisfies Record<string, EventArea>

export type Feature = keyof typeof FEATURE_AREA

const isClient = () => typeof window !== 'undefined'

// Registered once per page load and again on a new visit, not on every event:
// register() rewrites persistence each call.
let visitRegistered = false

function noteVisit(now: number) {
  const visit = noteActivity(now)
  if (visit.newVisit || !visitRegistered) {
    visitRegistered = true
    const traits = visitTraits(visit.record, now)
    ph((posthog) => posthog.register(traits))
  }
  return visit.record
}

/** The one choke point every custom event passes. */
export function track(event: EventName, properties?: Record<string, unknown>): void {
  if (!isClient()) return
  const now = Date.now()
  const record = noteVisit(now)
  const milestones = milestonesFor(event, record, now, isClaimed)
  for (const milestone of milestones) claim(milestone.key, now)
  // Read now, not from the `route` super property: that is registered by the
  // pageview effect, which can run after the new page's own effects.
  const route = routeTemplate(window.location.pathname)
  const area = EVENT_AREA[event]
  ph((posthog) => {
    posthog.capture(event, { area, route, ...properties })
    for (const milestone of milestones) {
      posthog.capture(milestone.key, {
        area: EVENT_AREA[milestone.key],
        route,
        ...milestone.properties,
      })
    }
  })
}

export function registerAnalyticsContext(
  properties: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!isClient()) return
  ph((posthog) => posthog.register(properties))
}

export function trackPageview(pathname: string): void {
  if (!isClient()) return
  noteVisit(Date.now())
  const route = routeTemplate(pathname)
  ph((posthog) => {
    posthog.register({ route })
    posthog.capture('$pageview', { route })
  })
}

// ---- What was downloaded ----------------------------------------------------

export interface ContentProps {
  platform?: string
  content_url?: string
  content_title?: string
  content_author?: string
  content_type: 'video' | 'images' | 'embed'
  duration_s?: number
  image_count?: number
  size_mb?: number
}

interface ContentMeta {
  title?: string
  author?: string
  duration?: number
  platform?: string
  sizeBytes?: number
  embedUrl?: string
  images?: unknown[]
}

const toMb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10

function contentType(meta: ContentMeta | null | undefined): ContentProps['content_type'] {
  if (meta?.embedUrl) return 'embed'
  return meta?.images?.length ? 'images' : 'video'
}

/**
 * The record of one piece of content. The privacy page says this is collected;
 * adding a field here means re-reading what the page promises.
 */
export function contentProps(
  meta: ContentMeta | null | undefined,
  link: string | null | undefined,
): ContentProps {
  return {
    platform: meta?.platform,
    content_url: contentLink(link),
    content_title: meta?.title || undefined,
    content_author: meta?.author || undefined,
    content_type: contentType(meta),
    duration_s: meta?.duration || undefined,
    image_count: meta?.images?.length || undefined,
    size_mb: meta?.sizeBytes ? toMb(meta.sizeBytes) : undefined,
  }
}

// ---- Resolve ----------------------------------------------------------------

export type LinkSource =
  | 'typed'
  | 'paste_chip'
  | 'paste_anywhere'
  | 'clipboard_watch'
  | 'share_target'
  | 'history'
  | 'retry'
  | 'repick'
  | 'dropped'
  | 'multi_paste'
  | 'batch'

export function trackLinkSubmitted(props: {
  platform: string
  source: LinkSource
  format?: string
  quality?: string
}): void {
  track(EVENTS.LINK_SUBMITTED, props)
}

/** A link refused without a request: a profile, a playlist, a site's front page. */
export function trackLinkRejected(props: { platform: string; reason: string }): void {
  track(EVENTS.LINK_REJECTED, props)
}

export function trackResolveSucceeded(
  content: ContentProps,
  props: { duration_ms: number; format: string; quality: string },
): void {
  track(EVENTS.RESOLVE_SUCCEEDED, { ...content, ...props })
}

export function trackResolveFailed(props: {
  platform: string
  message: string | undefined
  duration_ms: number
  format: string
}): void {
  const code = failureCode(props.message)
  const expected = isExpectedFailure(code)
  const message = scrubText(props.message ?? 'no error text').slice(0, 200)
  track(EVENTS.RESOLVE_FAILED, {
    platform: props.platform,
    code,
    message,
    duration_ms: props.duration_ms,
    format: props.format,
  })
  if (expected) return
  trackError({
    source: `resolve:${props.platform}`,
    message,
    status: code,
  })
}

// ---- Download ---------------------------------------------------------------

export type DownloadKind =
  | 'video'
  | 'audio'
  | 'images'
  | 'zip'
  | 'slideshow'
  | 'subtitle'
  | 'thumbnail'
  | 'lightbox_image'
  | 'batch_zip'

export interface DownloadHandle {
  completed(extra?: { size_bytes?: number; delivery?: string }): void
  failed(error: unknown): void
  canceled(): void
}

/**
 * One transfer, from the button to the file. Returned as a handle so each
 * handler reports its outcome where it already branches, and the timing and the
 * content record cannot differ between them.
 */
export function beginDownload(
  kind: DownloadKind,
  content: Partial<ContentProps>,
  extra?: Record<string, unknown>,
): DownloadHandle {
  const startedAt = Date.now()
  const base = { kind, ...content, ...extra }
  const elapsed = () => Date.now() - startedAt
  track(EVENTS.DOWNLOAD_STARTED, base)
  return {
    completed({ size_bytes, delivery } = {}) {
      track(EVENTS.DOWNLOAD_COMPLETED, {
        ...base,
        delivery,
        duration_ms: elapsed(),
        ...(size_bytes ? { size_mb: toMb(size_bytes) } : {}),
      })
    },
    failed(error) {
      const raw = errorMessage(error)
      const code = failureCode(raw)
      const message = scrubText(raw).slice(0, 200)
      track(EVENTS.DOWNLOAD_FAILED, {
        ...base,
        code,
        message,
        duration_ms: elapsed(),
      })
      if (isExpectedFailure(code)) return
      trackError({ source: `download:${kind}`, message, status: code })
    },
    canceled() {
      track(EVENTS.DOWNLOAD_CANCELED, { ...base, duration_ms: elapsed() })
    },
  }
}

// ---- Batches ----------------------------------------------------------------

export function trackBatchStarted(props: {
  surface: 'multi_paste' | 'batch_panel'
  count: number
  format?: string
  lanes?: number
  is_retry?: boolean
}): void {
  track(EVENTS.BATCH_STARTED, props)
}

export function trackBatchFinished(props: {
  surface: 'multi_paste' | 'batch_panel'
  count: number
  ok: number
  failed: number
}): void {
  track(EVENTS.BATCH_FINISHED, props)
}

export function trackBatchCanceled(props: { count: number }): void {
  track(EVENTS.BATCH_CANCELED, props)
}

export function trackPlaylistImported(props: { count: number; ok: boolean }): void {
  track(EVENTS.PLAYLIST_IMPORTED, props)
}

// ---- Accounts and Pro -------------------------------------------------------

export function trackSignedIn(): void {
  track(EVENTS.SIGNED_IN)
}

export function trackSignedOut(props: { all_devices: boolean }): void {
  track(EVENTS.SIGNED_OUT, props)
  ph((posthog) => posthog.reset())
}

export function trackAccountDeleted(): void {
  track(EVENTS.ACCOUNT_DELETED)
  ph((posthog) => posthog.reset())
}

export function trackPlanCanceled(): void {
  track(EVENTS.PLAN_CANCELED)
}

/** Which placement sends people to /pro, so the ones that convert nobody can go. */
export function trackProCtaClicked(props: { surface: string }): void {
  track(EVENTS.PRO_CTA_CLICKED, props)
}

export function trackProNudgeShown(props: { nudge: string }): void {
  track(EVENTS.PRO_NUDGE_SHOWN, props)
}

export function identifyAccount(
  userId: string,
  traits: { pro: boolean; plan?: string | null },
): void {
  if (!isClient()) return
  ph((posthog) => {
    // The account id, never the email.
    posthog.identify(userId, traits)
    posthog.register({ signed_in: true, pro: traits.pro })
  })
}

// ---- PWA --------------------------------------------------------------------

const PWA_INSTALLABLE_KEY = 'smd_pwa_installable'

/** Once per tab session: Chrome re-fires the event on every full page load. */
export function trackPwaInstallable(): void {
  try {
    if (sessionStorage.getItem(PWA_INSTALLABLE_KEY)) return
    sessionStorage.setItem(PWA_INSTALLABLE_KEY, '1')
  } catch {
    // Storage blocked: count it rather than lose it.
  }
  track(EVENTS.PWA_INSTALLABLE)
}

export function trackPwaPrompted(props: {
  outcome: 'accepted' | 'dismissed' | 'closed' | 'ios_hint_closed'
}): void {
  track(EVENTS.PWA_PROMPTED, props)
}

export function trackPwaInstalled(): void {
  track(EVENTS.PWA_INSTALLED)
  ph((posthog) => posthog.setPersonProperties({ pwa_installed: true }))
}

// ---- Consolidated kinds -----------------------------------------------------

/** Called only from the settings save paths. Values are enums, never free text. */
export function trackPrefChanged(props: { key: string; value: string }): void {
  track(EVENTS.PREF_CHANGED, props)
}

export function trackShared(props: {
  surface: string
  method: 'web_share' | 'clipboard' | 'file_share'
  outcome: 'done' | 'dismissed' | 'failed'
}): void {
  track(EVENTS.SHARED, props)
}

export function trackRetryClicked(props: { surface: string }): void {
  track(EVENTS.RETRY_CLICKED, props)
}

export function trackFeatureUsed(
  feature: Feature,
  props?: { action?: string; outcome?: string; count?: number },
): void {
  track(EVENTS.FEATURE_USED, {
    feature,
    area: FEATURE_AREA[feature],
    action: 'use',
    ...props,
  })
}

// ---- Health -----------------------------------------------------------------

export function trackPageNotFound(): void {
  track(EVENTS.PAGE_NOT_FOUND)
}

/**
 * A caught failure. Sends `api_error` (trendable) and, unless `expected`, a real
 * `$exception` fingerprinted `flow:code`. The Error is built HERE, not in the
 * `ph` callback: a stack is captured where it is constructed, and that callback
 * may only run once the SDK has loaded.
 */
export function trackError(props: {
  source: string
  message: string
  status?: number | string
  expected?: boolean
}): void {
  if (!isClient()) return
  const message = scrubText(props.message).slice(0, 200)
  track(EVENTS.API_ERROR, { ...props, message })
  if (props.expected) return
  const error = new Error(`[${props.source}] ${message}`)
  ph((posthog) => {
    try {
      posthog.captureException(error, {
        $exception_fingerprint: `${props.source}:${props.status ?? 'none'}`,
        source: props.source,
        status: props.status,
      })
    } catch {
      // Reporting must never throw over the failure it is reporting.
    }
  })
}

/** Network and offline failures are measurable but never an Error Tracking issue. */
export function trackCaughtError(source: string, error: unknown): void {
  const message = errorMessage(error)
  const code = failureCode(message)
  trackError({ source, message, status: code, expected: isExpectedFailure(code) })
}
