/**
 * Context every event carries, and the once-ever milestones derived from it.
 *
 * Same shape as the sister project: `route` says which screen something came
 * from, `visit_n` and `days_since_first_visit` say how far into somebody's life
 * with the site it happened, and `first_download` says how long a new visitor
 * took to reach the thing the site exists for.
 *
 * Everything decision-shaped is pure so analyticsContext.test.ts can pin it;
 * the storage glue at the bottom is the only part that touches the browser.
 */

import { stripLocale } from '@/lib/localeRoutes'

/**
 * Pages are all static slugs here, so only the trailing slash and the language
 * need folding: /es/tiktok-downloader is the same screen as /tiktok-downloader,
 * and the `locale` property says which one it was.
 */
export function routeTemplate(pathname: string): string {
  const path = stripLocale(pathname.split('?')[0].replace(/\/+$/, ''))
  return path || '/'
}

/** Inactivity that ends a visit — PostHog's own session timeout. */
export const VISIT_GAP_MS = 30 * 60 * 1000

export interface VisitRecord {
  first_at: number
  last_at: number
  visit_n: number
  /**
   * The browser already used the site before this record existed, so `first_at`
   * is when counting began rather than when the visitor arrived. Milestones
   * never fire for it: its first download happened long ago and would read as
   * activation.
   */
  seeded: boolean
}

/**
 * Advance the record for activity at `now`. A new browser starts at visit 1; a
 * gap longer than VISIT_GAP_MS starts the next visit.
 */
export function nextVisit(
  prev: VisitRecord | null,
  now: number,
  seenBefore: boolean,
): { record: VisitRecord; newVisit: boolean } {
  if (!prev) {
    return {
      record: { first_at: now, last_at: now, visit_n: 1, seeded: seenBefore },
      newVisit: true,
    }
  }
  const newVisit = now - prev.last_at > VISIT_GAP_MS
  return {
    record: {
      ...prev,
      last_at: now,
      visit_n: newVisit ? prev.visit_n + 1 : prev.visit_n,
    },
    newVisit,
  }
}

/** Super properties derived from the record — carried on every event. */
export function visitTraits(record: VisitRecord, now: number) {
  return {
    visit_n: record.visit_n,
    days_since_first_visit: Math.floor((now - record.first_at) / 86_400_000),
    returning_visitor: record.visit_n > 1 || record.seeded,
  }
}

/** The core actions, by the event that proves each one happened. */
export const CORE_FEATURE: Record<string, string> = {
  download_completed: 'download',
  resolve_succeeded: 'resolve',
}

export interface Milestone {
  /** Latch key — fires once per browser, ever. */
  key: 'first_download' | 'first_core_use'
  properties: Record<string, unknown>
}

/**
 * Which once-ever events `event` earns, given which latches are already set.
 * Derived in `track`, the one choke point every event passes, so no call site
 * can forget them.
 */
export function milestonesFor(
  event: string,
  record: VisitRecord,
  now: number,
  claimed: (key: string) => boolean,
): Milestone[] {
  const feature = CORE_FEATURE[event]
  if (!feature || record.seeded) return []
  const base = {
    since_first_visit_s: Math.round((now - record.first_at) / 1000),
    visit_n: record.visit_n,
  }
  const out: Milestone[] = []
  if (!claimed('first_core_use')) {
    out.push({ key: 'first_core_use', properties: { ...base, feature } })
  }
  if (feature === 'download' && !claimed('first_download')) {
    out.push({ key: 'first_download', properties: base })
  }
  return out
}

const VISIT_KEY = 'smd_visit'
const ONCE_PREFIX = 'smd_once:'

// This module's own keys and the SDK's latches say nothing about past use.
const OWN_KEY = /^smd_(visit|once:|ph_)/

/** The app's keys use both `smd:` and `smd_`, so a test on one misses most. */
export function isPriorUseKey(key: string | null): boolean {
  return key !== null && /^smd[:_]/.test(key) && !OWN_KEY.test(key)
}

// Evidence this browser used the site before the visit record existed: the app's
// own keys (preferences, resolve counts, profile) all predate analytics.
function seenBefore(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      if (isPriorUseKey(window.localStorage.key(i))) return true
    }
  } catch {
    // Storage blocked: treat as new, which only risks one extra milestone.
  }
  return false
}

function readVisit(): VisitRecord | null {
  try {
    const raw = window.localStorage.getItem(VISIT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VisitRecord>
    if (typeof parsed.first_at !== 'number') return null
    return {
      first_at: parsed.first_at,
      last_at: Number(parsed.last_at) || parsed.first_at,
      visit_n: Number(parsed.visit_n) || 1,
      seeded: parsed.seeded === true,
    }
  } catch {
    return null
  }
}

/** Record activity now; returns the current record and whether a visit began. */
export function noteActivity(now = Date.now()): {
  record: VisitRecord
  newVisit: boolean
} {
  const prev = readVisit()
  const next = nextVisit(prev, now, prev ? prev.seeded : seenBefore())
  try {
    window.localStorage.setItem(VISIT_KEY, JSON.stringify(next.record))
  } catch {
    // Without storage every load is visit 1; events still send.
  }
  return next
}

export function isClaimed(key: string): boolean {
  try {
    return window.localStorage.getItem(ONCE_PREFIX + key) !== null
  } catch {
    // Blocked storage cannot latch, so claim it rather than fire on every event.
    return true
  }
}

export function claim(key: string, now = Date.now()): void {
  try {
    window.localStorage.setItem(ONCE_PREFIX + key, String(now))
  } catch {
    // isClaimed already answers true for this browser.
  }
}
