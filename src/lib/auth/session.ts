/**
 * Sessions: the long-lived half of authentication.
 *
 * A session is a random 256-bit value handed to the browser in an httpOnly
 * cookie. Only its SHA-256 lands in D1, so a leaked database read does not hand
 * anyone a working session. Revocation is a hard DELETE — a `revoked_at` flag
 * would put a `WHERE revoked_at IS NULL` on every query in exchange for history
 * nobody reads.
 *
 * This module is the only thing that talks to the `sessions` table.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { sha256Hex } from '../proToken'
import type { BillingRow } from '../billing/entitlement'
import { HINT_COOKIE, SESSION_COOKIE } from './cookies'

// Re-exported so existing importers of these two names from `./session` keep
// working; see cookies.ts for why the constants themselves live there.
export { SESSION_COOKIE, HINT_COOKIE } from './cookies'

export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Five concurrent sessions per account. The successor to the license key's five
 * activation slots, and the only thing bounding how far one account can be
 * shared — a sixth sign-in evicts the oldest.
 */
export const MAX_SESSIONS = 5

/** The `users` row, as every caller here needs it. */
export interface UserRow extends BillingRow {
  id: string
  google_sub: string
  email: string
  created_at: number
  prefs: string | null
  ls_subscription_id: string | null
  ls_variant: string | null
  ls_renews_at: number | null
  ls_updated_at: number | null
}

/**
 * Which sessions must go so that inserting one more stays within the cap.
 * Callers pass rows already ordered oldest-first.
 */
export function sessionsToEvict(
  existing: { id: string }[],
  max: number = MAX_SESSIONS,
): string[] {
  const surplus = existing.length - max + 1
  if (surplus <= 0) return []
  return existing.slice(0, surplus).map((row) => row.id)
}

/**
 * Split on `;` and compare the name exactly, rather than a substring or regex
 * match — `not_smd_session=x` must not read as `smd_session`.
 */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return null
}

export function sessionCookieHeaders(value: string, maxAgeSeconds: number): string[] {
  const shared = `Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`
  return [
    `${SESSION_COOKIE}=${value}; ${shared}; HttpOnly`,
    `${HINT_COOKIE}=1; ${shared}`,
  ]
}

export function clearCookieHeaders(): string[] {
  return sessionCookieHeaders('', 0).map((header) =>
    header.replace(`${HINT_COOKIE}=1`, `${HINT_COOKIE}=`),
  )
}

const USER_COLUMNS =
  'id, google_sub, email, created_at, prefs, ls_subscription_id, ls_status, ' +
  'ls_variant, ls_renews_at, ls_ends_at, ls_past_due_since, ls_updated_at'

/**
 * Mint a session, evicting the oldest if the user is already at the cap.
 * Returns the raw cookie value; only its hash is stored.
 */
export async function createSession(
  db: D1Database,
  userId: string,
  now: number,
): Promise<string> {
  const existing = await db
    .prepare('SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at ASC')
    .bind(userId)
    .all<{ id: string }>()

  const evict = sessionsToEvict(existing.results ?? [])
  if (evict.length > 0) {
    const placeholders = evict.map(() => '?').join(', ')
    await db
      .prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`)
      .bind(...evict)
      .run()
  }

  const raw = crypto.randomUUID() + crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(await sha256Hex(raw), userId, now, now + SESSION_TTL_MS)
    .run()

  return raw
}

/**
 * One indexed join, so D1 scans two rows rather than a table. An expired
 * session reads as absent; the row is left for the next write to clean up
 * rather than spending a write on every read.
 */
export async function loadSession(
  db: D1Database,
  rawCookie: string | null,
  now: number,
): Promise<UserRow | null> {
  if (!rawCookie) return null
  const row = await db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users
       JOIN sessions ON sessions.user_id = users.id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
    .bind(await sha256Hex(rawCookie), now)
    .first<UserRow>()
  return row ?? null
}

export async function deleteSession(db: D1Database, rawCookie: string | null): Promise<void> {
  if (!rawCookie) return
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(rawCookie)).run()
}

export async function deleteAllSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}
