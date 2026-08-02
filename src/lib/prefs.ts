'use client'

/**
 * The two sticky download preferences (quality and format), held in a tiny
 * external store instead of component state.
 *
 * They used to be `useState` defaults rehydrated by a mount effect that read
 * localStorage and called setState. That is the exact cascade
 * `react-hooks/set-state-in-effect` exists to catch, and it also meant the
 * toggles visibly flipped from the default to the stored value a frame after
 * paint.
 *
 * Modelling them as an external store fixes both: `useSyncExternalStore` uses
 * the server snapshot while prerendering and during hydration, then reads the
 * stored value on the very first client pass — no effect, no extra render, and
 * no hydration mismatch. Writes update the cache, persist, and notify.
 */

import { useSyncExternalStore } from 'react'

export type Quality = 'hd' | 'sd'
export type Format = 'video' | 'audio'

export interface Prefs {
  quality: Quality
  format: Format
}

const QUALITY_KEY = 'smd:quality'
const FORMAT_KEY = 'smd:format'

/**
 * Stable reference on purpose. Snapshots are compared by identity, so handing
 * back a fresh object each call would re-render forever.
 */
const DEFAULTS: Prefs = Object.freeze({ quality: 'hd', format: 'video' })

let cache: Prefs | null = null
const listeners = new Set<() => void>()

function isQuality(value: string | null): value is Quality {
  return value === 'hd' || value === 'sd'
}

function isFormat(value: string | null): value is Format {
  return value === 'video' || value === 'audio'
}

function readStored(): Prefs {
  try {
    const quality = window.localStorage.getItem(QUALITY_KEY)
    const format = window.localStorage.getItem(FORMAT_KEY)
    return {
      quality: isQuality(quality) ? quality : DEFAULTS.quality,
      format: isFormat(format) ? format : DEFAULTS.format,
    }
  } catch {
    // Storage blocked (private mode, cookie policy) — defaults are fine.
    return DEFAULTS
  }
}

function getSnapshot(): Prefs {
  cache ??= readStored()
  return cache
}

function getServerSnapshot(): Prefs {
  return DEFAULTS
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked — the in-memory value still applies for this session.
  }
}

function commit(next: Prefs): void {
  cache = next
  for (const listener of listeners) listener()
}

export function setQuality(quality: Quality): void {
  const current = getSnapshot()
  if (current.quality === quality) return
  write(QUALITY_KEY, quality)
  commit({ ...current, quality })
}

export function setFormat(format: Format): void {
  const current = getSnapshot()
  if (current.format === format) return
  write(FORMAT_KEY, format)
  commit({ ...current, format })
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Validate whatever arrived from the network or the database.
 *
 * Accepts both the parsed object and the raw JSON string, because the `prefs`
 * column stores a string and the API hands back either. A missing field falls
 * back to its default; a *wrong* field is rejected outright, since that means
 * something upstream is confused and silently coercing it would hide the bug.
 */
export function normalisePrefs(value: unknown): Prefs | null {
  if (value === null || value === undefined) return null

  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return null
    }
  }
  if (typeof candidate !== 'object' || candidate === null) return null

  const { quality, format } = candidate as { quality?: unknown; format?: unknown }
  if (quality !== undefined && !isQuality(quality as string)) return null
  if (format !== undefined && !isFormat(format as string)) return null

  return {
    quality: (quality as Quality) ?? DEFAULTS.quality,
    format: (format as Format) ?? DEFAULTS.format,
  }
}

/**
 * Server wins when it has an opinion; otherwise the local choices are carried
 * up. Signing in must never silently change how the tool behaves for someone
 * who already set their preferences in this browser.
 */
export function mergePrefs(local: Prefs, server: Prefs | null): Prefs {
  return server ?? local
}

/**
 * Called after a refresh with whatever the `prefs` column held. Pushes local
 * values up on a first login, and adopts the server's on every later one.
 */
export function adoptServerPrefs(raw: unknown): void {
  const server = normalisePrefs(raw)
  const merged = mergePrefs(getSnapshot(), server)

  if (!server) {
    void persistPrefs(merged)
    return
  }

  if (merged.quality !== getSnapshot().quality) setQuality(merged.quality)
  if (merged.format !== getSnapshot().format) setFormat(merged.format)
}

/** Write the current preferences to the account, if there is one. */
export async function persistPrefs(prefs: Prefs): Promise<void> {
  try {
    await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    })
  } catch {
    // Local storage already has the value; the next change retries.
  }
}
