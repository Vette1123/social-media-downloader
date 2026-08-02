/**
 * The preference *values* and their validation — no React, no storage, no
 * `'use client'`.
 *
 * This exists so the Worker can validate a POSTed `prefs` body without loading
 * the client store. `src/lib/prefs.ts` carries the `'use client'` directive and
 * imports React; when the /api/account handler imported `normalisePrefs` from
 * there, the emitted bundle evaluated React's entire module scope on the first
 * account request in every isolate — inside a 10 ms CPU budget — to run a
 * twenty-line validator. One implementation, two importers: the client store
 * re-exports these, the server route imports them directly.
 */

export type Quality = 'hd' | 'sd'
export type Format = 'video' | 'audio'

export interface Prefs {
  quality: Quality
  format: Format
}

/**
 * Stable reference on purpose. Snapshots are compared by identity, so handing
 * back a fresh object each call would re-render forever.
 */
export const DEFAULTS: Prefs = Object.freeze({ quality: 'hd', format: 'video' })

export function isQuality(value: unknown): value is Quality {
  return value === 'hd' || value === 'sd'
}

export function isFormat(value: unknown): value is Format {
  return value === 'video' || value === 'audio'
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
  if (quality !== undefined && !isQuality(quality)) return null
  if (format !== undefined && !isFormat(format)) return null

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
