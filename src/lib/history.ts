// Local, privacy-friendly download history.
//
// Persists a small list of successfully-resolved links in localStorage so a user
// can re-open something they grabbed before without re-pasting. We store the
// ORIGINAL post URL + light metadata — never the resolved CDN/stream URL, which
// is short-lived and signed. Re-downloading re-runs the normal resolve flow.
//
// Everything is guarded for SSR (no window during prerender) and degrades to a
// no-op if storage is unavailable (private mode, quota, disabled).

import type { SupportedPlatform } from '@/lib/validator'

export interface HistoryEntry {
  /** Stable key — the original post URL. */
  url: string
  title: string
  author: string
  platform?: SupportedPlatform
  thumbnail?: string
  /** Epoch ms; set by the caller (module can't call Date.now during render). */
  ts: number
}

const KEY = 'smd:history:v1'
// Keep a generous backlog so "View all" is worth opening; the Recent list shows
// a handful by default and expands to the rest.
const MAX = 30

function canUse(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function loadHistory(): HistoryEntry[] {
  if (!canUse()) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    // Keep only well-shaped entries — tolerate schema drift from older versions.
    return parsed
      .filter(
        (e): e is HistoryEntry =>
          !!e &&
          typeof e === 'object' &&
          typeof (e as HistoryEntry).url === 'string' &&
          typeof (e as HistoryEntry).ts === 'number',
      )
      .slice(0, MAX)
  } catch {
    return []
  }
}

/**
 * Prepend an entry (most-recent-first), dedupe by URL, cap the list, persist.
 * Returns the new list so the caller can update state without a re-read.
 */
export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  if (!canUse()) return []
  const existing = loadHistory().filter((e) => e.url !== entry.url)
  const next = [entry, ...existing].slice(0, MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // quota / disabled — history is best-effort, ignore.
  }
  return next
}

export function removeHistory(url: string): HistoryEntry[] {
  if (!canUse()) return []
  const next = loadHistory().filter((e) => e.url !== url)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function clearHistory(): void {
  if (!canUse()) return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
